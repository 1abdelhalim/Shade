import { MESSAGE, SANDBOX } from "../shared/constants.js";

const FRAME_RPC_TIMEOUT_MS = 45_000;

function sandboxFrame() {
  return document.getElementById("shade-sandbox-frame");
}

function sandboxWindow() {
  return sandboxFrame()?.contentWindow ?? null;
}

let nextRpcId = 1;
const pendingRpc = new Map();

let resolveSandboxInited;
const sandboxInited = new Promise((resolve) => {
  resolveSandboxInited = resolve;
});

window.addEventListener("message", (event) => {
  const win = sandboxWindow();
  if (!win || event.source !== win) {
    return;
  }

  if (event.data?.type === SANDBOX.READY) {
    void (async () => {
      const wasmBaseUrl = chrome.runtime.getURL("vendor/tflite-wasm/");
      const modelUrl = chrome.runtime.getURL("models/shade_small_v2.tflite");
      let modelBytes = null;
      try {
        const res = await fetch(modelUrl);
        if (res.ok) {
          modelBytes = await res.arrayBuffer();
        }
      } catch {
        /* Sandbox will try modelUrl if transfer unavailable. */
      }
      const basePayload = { type: SANDBOX.INIT, wasmBaseUrl, modelUrl };
      if (modelBytes) {
        win.postMessage({ ...basePayload, modelBytes }, "*", [modelBytes]);
      } else {
        win.postMessage(basePayload, "*");
      }
    })();
    return;
  }

  if (event.data?.type === SANDBOX.INITED) {
    resolveSandboxInited?.();
    resolveSandboxInited = null;
    return;
  }

  if (event.data?.type === SANDBOX.RESULT) {
    const { id } = event.data;
    const entry = pendingRpc.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      pendingRpc.delete(id);
      entry.resolve(event.data);
    }
  }
});

function callSandboxProcess(payload) {
  return new Promise((resolve, reject) => {
    const win = sandboxWindow();
    if (!win) {
      reject(new Error("sandbox iframe missing"));
      return;
    }
    const id = nextRpcId++;
    const timer = setTimeout(() => {
      if (pendingRpc.has(id)) {
        pendingRpc.delete(id);
        reject(new Error("sandbox inference timeout"));
      }
    }, FRAME_RPC_TIMEOUT_MS);
    pendingRpc.set(id, { resolve, timer });
    win.postMessage({ type: SANDBOX.PROCESS, id, ...payload }, "*");
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE.PROCESS_FRAME) {
    return false;
  }

  const run = async () => {
    await sandboxInited;
    const rpc = await callSandboxProcess({
      dataUrl: message.dataUrl,
      settings: message.settings
    });

    if (!rpc.ok) {
      throw new Error(rpc.error || "sandbox inference failed");
    }

    await chrome.runtime.sendMessage({
      type: MESSAGE.APPLY_DETECTIONS,
      tabId: message.tabId,
      boxes: rpc.boxes,
      frameSize: rpc.frameSize,
      settings: message.settings
    });

    return { ok: true, count: rpc.boxes?.length ?? 0 };
  };

  run()
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
