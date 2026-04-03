import { MESSAGE } from "../shared/constants.js";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

async function bootstrap() {
  const tab = await getActiveTab();
  const [{ settings }, status] = await Promise.all([
    chrome.runtime.sendMessage({ type: MESSAGE.GET_SETTINGS }),
    chrome.runtime.sendMessage({
      type: MESSAGE.GET_TAB_STATUS,
      tabId: tab?.id
    })
  ]);

  const protectToggle = document.getElementById("protectToggle");
  const confidence = document.getElementById("confidence");
  const opacity = document.getElementById("opacity");
  const performanceToggle = document.getElementById("performanceToggle");

  protectToggle.checked = Boolean(status?.enabled);
  confidence.value = String(settings.confidence_percent);
  opacity.value = String(settings.overlay_opacity);
  performanceToggle.checked = Boolean(settings.power_mode_enabled);

  setText("confidenceValue", `${Math.round(settings.confidence_percent)}%`);
  setText("opacityValue", `${Math.round(settings.overlay_opacity)}%`);

  protectToggle.addEventListener("change", async () => {
    if (!tab?.id) {
      return;
    }
    await chrome.runtime.sendMessage({
      type: MESSAGE.TOGGLE_TAB_PROTECTION,
      tabId: tab.id,
      enabled: protectToggle.checked
    });
  });

  confidence.addEventListener("input", async () => {
    setText("confidenceValue", `${Math.round(Number(confidence.value))}%`);
    await chrome.runtime.sendMessage({
      type: MESSAGE.UPDATE_SETTINGS,
      patch: { confidence_percent: Number(confidence.value) }
    });
  });

  opacity.addEventListener("input", async () => {
    setText("opacityValue", `${Math.round(Number(opacity.value))}%`);
    await chrome.runtime.sendMessage({
      type: MESSAGE.UPDATE_SETTINGS,
      patch: { overlay_opacity: Number(opacity.value) }
    });
  });

  performanceToggle.addEventListener("change", async () => {
    await chrome.runtime.sendMessage({
      type: MESSAGE.UPDATE_SETTINGS,
      patch: { power_mode_enabled: performanceToggle.checked }
    });
  });
}

bootstrap().catch(() => {});
