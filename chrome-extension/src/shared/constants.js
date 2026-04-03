export const DEFAULT_CONFIDENCE_PERCENT = 70;
export const DEFAULT_OVERLAY_OPACITY = 100;
export const DEFAULT_PIXELATION_LEVEL = 15;
export const MIN_PIXELATION_LEVEL = 5;
export const MAX_PIXELATION_LEVEL = 30;

export const DEFAULT_SETTINGS = {
  confidence_percent: DEFAULT_CONFIDENCE_PERCENT,
  power_mode_enabled: false,
  overlay_opacity: DEFAULT_OVERLAY_OPACITY,
  full_screen_mode_enabled: false,
  has_completed_onboarding_flow: false,
  has_shown_unsupported_device_dialog: false,
  has_seen_single_app_capture_tip: false,
  auto_start_apps: [],
  pixelation_level: DEFAULT_PIXELATION_LEVEL,
  detailed_mode_enabled: false
};

export const MESSAGE = {
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

export const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

/** postMessage types: offscreen document <-> sandboxed inference iframe */
export const SANDBOX = {
  READY: "shade/sandbox-ready",
  INIT: "shade/sandbox-init",
  INITED: "shade/sandbox-inited",
  PROCESS: "shade/sandbox-process",
  RESULT: "shade/sandbox-result"
};

export const PROCESS_INTERVAL_MS_NORMAL = 700;
export const PROCESS_INTERVAL_MS_POWER = 1200;
