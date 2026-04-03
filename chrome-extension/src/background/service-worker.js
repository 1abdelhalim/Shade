import {
  MESSAGE,
  OFFSCREEN_DOCUMENT_PATH,
  PROCESS_INTERVAL_MS_NORMAL,
  PROCESS_INTERVAL_MS_POWER
} from "../shared/constants.js";
import { ensureSettingsBootstrapped, getSettings, updateSettings } from "../shared/settings.js";

const protectedTabs = new Map();
let captureTimer = null;

/** Serialize createDocument — parallel setTabProtection calls must not race. */
let offscreenEnsureChain = Promise.resolve();

function isSupportedUrl(url = "") {
  return /^https?:\/\//i.test(url);
}

function isSingleOffscreenError(error) {
  const msg = String(error?.message ?? error ?? "");
  return (
    msg.includes("single offscreen") ||
    msg.includes("Only a single offscreen") ||
    msg.includes("offscreen document may be created")
  );
}

async function hasOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) {
    try {
      return await chrome.offscreen.hasDocument();
    } catch {
      // Fall through to getContexts.
    }
  }
  if (!chrome.runtime.getContexts) {
    return false;
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocumentImpl() {
  if (await hasOffscreenDocument()) {
    return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["BLOBS"],
      justification: "Process captured tab frames locally for sensitive-content blur."
    });
  } catch (error) {
    if (isSingleOffscreenError(error) || (await hasOffscreenDocument())) {
      return;
    }
    throw error;
  }
}

function ensureOffscreenDocument() {
  offscreenEnsureChain = offscreenEnsureChain
    .then(() => ensureOffscreenDocumentImpl())
    .catch((error) => {
      if (!isSingleOffscreenError(error)) {
        console.error("Shade offscreen ensure failed:", error);
      }
    });
  return offscreenEnsureChain;
}

function broadcastStatus(tabId, enabled) {
  chrome.runtime.sendMessage({
    type: MESSAGE.TAB_STATUS_CHANGED,
    tabId,
    enabled
  }).catch(() => {});
}

async function setTabProtection(tabId, enabled) {
  if (enabled) {
    protectedTabs.set(tabId, { enabledAt: Date.now() });
  } else {
    protectedTabs.delete(tabId);
  }

  await chrome.tabs.sendMessage(tabId, {
    type: MESSAGE.TAB_STATUS_CHANGED,
    enabled
  }).catch(() => {});
  broadcastStatus(tabId, enabled);

  if (protectedTabs.size > 0) {
    await ensureOffscreenDocument();
    startCaptureLoop();
  } else {
    stopCaptureLoop();
  }
}

function stopCaptureLoop() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
}

async function processTick() {
  if (protectedTabs.size === 0) {
    return;
  }

  const settings = await getSettings();
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab?.id || !protectedTabs.has(activeTab.id)) {
    return;
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
    format: "jpeg",
    quality: settings.power_mode_enabled ? 45 : 65
  });

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE.PROCESS_FRAME,
      tabId: activeTab.id,
      dataUrl,
      settings
    });
  } catch {
    await ensureOffscreenDocument();
  }
}

function startCaptureLoop() {
  stopCaptureLoop();
  getSettings()
    .then((settings) => {
      const everyMs = settings.power_mode_enabled
        ? PROCESS_INTERVAL_MS_POWER
        : PROCESS_INTERVAL_MS_NORMAL;
      captureTimer = setInterval(() => {
        processTick().catch(() => {});
      }, everyMs);
    })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettingsBootstrapped();
  const tabs = await chrome.tabs.query({});
  const eligible = tabs.filter(
    (tab) => typeof tab.id === "number" && isSupportedUrl(tab.url)
  );
  for (const tab of eligible) {
    await setTabProtection(tab.id, true);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureSettingsBootstrapped();
  const tabs = await chrome.tabs.query({});
  const eligible = tabs.filter(
    (tab) => typeof tab.id === "number" && isSupportedUrl(tab.url)
  );
  for (const tab of eligible) {
    await setTabProtection(tab.id, true);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  protectedTabs.delete(tabId);
  if (protectedTabs.size === 0) {
    stopCaptureLoop();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isSupportedUrl(tab?.url)) {
    setTabProtection(tabId, true).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case MESSAGE.GET_SETTINGS: {
        return { settings: await getSettings() };
      }
      case MESSAGE.UPDATE_SETTINGS: {
        const settings = await updateSettings(message.patch || {});
        chrome.runtime.sendMessage({
          type: MESSAGE.SETTINGS_CHANGED,
          settings
        }).catch(() => {});
        startCaptureLoop();
        return { settings };
      }
      case MESSAGE.TOGGLE_TAB_PROTECTION: {
        const tabId = message.tabId ?? sender?.tab?.id;
        if (typeof tabId !== "number") {
          return { ok: false, error: "No tab id." };
        }
        const enabled = message.enabled ?? !protectedTabs.has(tabId);
        await setTabProtection(tabId, enabled);
        return { ok: true, tabId, enabled };
      }
      case MESSAGE.GET_TAB_STATUS: {
        const tabId = message.tabId ?? sender?.tab?.id;
        if (
          typeof tabId === "number" &&
          !protectedTabs.has(tabId) &&
          isSupportedUrl(sender?.tab?.url)
        ) {
          await setTabProtection(tabId, true);
        }
        const enabled = typeof tabId === "number" && protectedTabs.has(tabId);
        return { tabId, enabled };
      }
      case MESSAGE.APPLY_DETECTIONS: {
        if (typeof message.tabId === "number") {
          await chrome.tabs.sendMessage(message.tabId, message).catch(() => {});
        }
        return { ok: true };
      }
      case MESSAGE.GET_HEALTH: {
        return {
          protectedTabs: [...protectedTabs.keys()],
          offscreenReady: await hasOffscreenDocument()
        };
      }
      default:
        return null;
    }
  };

  run()
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
