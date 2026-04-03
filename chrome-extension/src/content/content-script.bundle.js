(() => {
  // src/shared/constants.js
  var MESSAGE = {
    GET_SETTINGS: "shade/get-settings",
    UPDATE_SETTINGS: "shade/update-settings",
    TOGGLE_TAB_PROTECTION: "shade/toggle-tab-protection",
    GET_TAB_STATUS: "shade/get-tab-status",
    SETTINGS_CHANGED: "shade/settings-changed",
    TAB_STATUS_CHANGED: "shade/tab-status-changed",
    PROCESS_FRAME: "shade/process-frame",
    APPLY_DETECTIONS: "shade/apply-detections",
    GET_HEALTH: "shade/get-health"
  };

  // src/content/content-script.js
  function documentMountTarget() {
    return document.documentElement || document.body || document.head || null;
  }
  var OVERLAY_ID = "shade-web-overlay-root";
  var STYLE_ID = "shade-web-style";
  var BOX_SIMILARITY_THRESHOLD = 0.015;
  var domSensitiveNodes = /* @__PURE__ */ new Set();
  var currentEnabled = false;
  var currentSettings = null;
  var lastBoxes = [];
  var cachedRegions = [];
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const mount = documentMountTarget();
    if (!mount) {
      return;
    }
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/content/shade-content.css");
    mount.appendChild(link);
  }
  function ensureOverlayRoot() {
    let root = document.getElementById(OVERLAY_ID);
    if (!root) {
      const mount = documentMountTarget();
      if (!mount) {
        return null;
      }
      root = document.createElement("div");
      root.id = OVERLAY_ID;
      mount.appendChild(root);
    }
    return root;
  }
  function clearOverlay() {
    const root = document.getElementById(OVERLAY_ID);
    if (root) {
      root.replaceChildren();
    }
    cachedRegions = [];
  }
  function clearDomBlur() {
    for (const node of domSensitiveNodes) {
      node.removeAttribute("data-shade-dom-sensitive");
      node.style.removeProperty("--shade-dom-blur");
    }
    domSensitiveNodes.clear();
  }
  function applyDomHeuristicBlur(settings) {
    const pixelation = Number(settings?.pixelation_level ?? 15);
    const blurPx = Math.max(8, Math.round(pixelation * 0.75));
    const bodyText = document.body?.innerText?.toLowerCase() || "";
    const sensitiveKeywords = ["nsfw", "nude", "adult", "explicit", "porn"];
    const likelySensitive = sensitiveKeywords.some((word) => bodyText.includes(word));
    if (likelySensitive) {
      const candidates = document.querySelectorAll("img, video, canvas");
      for (const element of candidates) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 120) {
          continue;
        }
        element.setAttribute("data-shade-dom-sensitive", "1");
        element.style.setProperty("--shade-dom-blur", `${blurPx}px`);
        domSensitiveNodes.add(element);
      }
      const textContainers = document.querySelectorAll("article, section, main");
      for (const container of textContainers) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 280 && rect.height > 220) {
          container.setAttribute("data-shade-dom-sensitive", "1");
          container.style.setProperty("--shade-dom-blur", `${Math.max(8, blurPx - 2)}px`);
          domSensitiveNodes.add(container);
        }
      }
    }
  }
  function isBoxSimilar(a, b) {
    return Math.abs(a.x1 - b.x1) < BOX_SIMILARITY_THRESHOLD && Math.abs(a.y1 - b.y1) < BOX_SIMILARITY_THRESHOLD && Math.abs(a.x2 - b.x2) < BOX_SIMILARITY_THRESHOLD && Math.abs(a.y2 - b.y2) < BOX_SIMILARITY_THRESHOLD;
  }
  function upsertRegionStyle(regionElement, box, opacity, pixel, blur) {
    regionElement.style.left = `${Math.round(box.x1 * window.innerWidth)}px`;
    regionElement.style.top = `${Math.round(box.y1 * window.innerHeight)}px`;
    regionElement.style.width = `${Math.round((box.x2 - box.x1) * window.innerWidth)}px`;
    regionElement.style.height = `${Math.round((box.y2 - box.y1) * window.innerHeight)}px`;
    regionElement.style.setProperty("--shade-opacity", opacity.toFixed(2));
    regionElement.style.setProperty("--shade-pixel", `${pixel}px`);
    regionElement.style.setProperty("--shade-blur", `${blur}px`);
  }
  function renderBoxes(boxes, settings) {
    if (window !== window.top) {
      return;
    }
    const root = ensureOverlayRoot();
    if (!root) {
      return;
    }
    const opacity = Number(settings?.overlay_opacity ?? 100) / 100;
    const pixel = Math.max(4, Number(settings?.pixelation_level ?? 15));
    const blur = Math.max(10, Math.round(pixel * 0.9));
    const nextCache = [];
    for (const box of boxes) {
      const cached = cachedRegions.find(
        (entry) => !entry.used && isBoxSimilar(entry.box, box)
      );
      if (cached) {
        cached.used = true;
        cached.box = box;
        upsertRegionStyle(cached.node, box, opacity, pixel, blur);
        nextCache.push(cached);
        continue;
      }
      const node = document.createElement("div");
      node.className = "shade-web-region";
      upsertRegionStyle(node, box, opacity, pixel, blur);
      root.appendChild(node);
      nextCache.push({ box, node, used: true });
    }
    for (const entry of cachedRegions) {
      if (!entry.used && entry.node.isConnected) {
        entry.node.remove();
      }
    }
    cachedRegions = nextCache.map((entry) => ({ ...entry, used: false }));
  }
  function applyProtection() {
    if (!currentEnabled) {
      clearOverlay();
      clearDomBlur();
      return;
    }
    applyDomHeuristicBlur(currentSettings);
    renderBoxes(lastBoxes, currentSettings);
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type) {
      return;
    }
    switch (message.type) {
      case MESSAGE.TAB_STATUS_CHANGED:
        currentEnabled = Boolean(message.enabled);
        applyProtection();
        break;
      case MESSAGE.SETTINGS_CHANGED:
        currentSettings = message.settings || currentSettings;
        applyProtection();
        break;
      case MESSAGE.APPLY_DETECTIONS:
        currentSettings = message.settings || currentSettings;
        lastBoxes = Array.isArray(message.boxes) ? message.boxes : [];
        applyProtection();
        break;
      default:
        break;
    }
  });
  async function bootstrap() {
    if (!documentMountTarget()) {
      return;
    }
    ensureStyle();
    ensureOverlayRoot();
    const [{ settings }, status] = await Promise.all([
      chrome.runtime.sendMessage({ type: MESSAGE.GET_SETTINGS }),
      chrome.runtime.sendMessage({ type: MESSAGE.GET_TAB_STATUS })
    ]);
    currentSettings = settings;
    currentEnabled = Boolean(status?.enabled);
    applyProtection();
  }
  bootstrap().catch(() => {
  });
  window.addEventListener("resize", () => {
    if (currentEnabled) {
      renderBoxes(lastBoxes, currentSettings);
    }
  });
})();
