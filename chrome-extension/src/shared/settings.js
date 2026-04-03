import {
  DEFAULT_SETTINGS,
  MAX_PIXELATION_LEVEL,
  MIN_PIXELATION_LEVEL
} from "./constants.js";

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function sanitizeSettings(raw = {}) {
  return {
    confidence_percent: clamp(
      raw.confidence_percent,
      0,
      100,
      DEFAULT_SETTINGS.confidence_percent
    ),
    power_mode_enabled: Boolean(raw.power_mode_enabled),
    overlay_opacity: clamp(
      raw.overlay_opacity,
      0,
      100,
      DEFAULT_SETTINGS.overlay_opacity
    ),
    full_screen_mode_enabled: Boolean(raw.full_screen_mode_enabled),
    has_completed_onboarding_flow: Boolean(raw.has_completed_onboarding_flow),
    has_shown_unsupported_device_dialog: Boolean(
      raw.has_shown_unsupported_device_dialog
    ),
    has_seen_single_app_capture_tip: Boolean(raw.has_seen_single_app_capture_tip),
    auto_start_apps: Array.isArray(raw.auto_start_apps)
      ? raw.auto_start_apps.map((item) => String(item))
      : [],
    pixelation_level: Math.round(
      clamp(
        raw.pixelation_level,
        MIN_PIXELATION_LEVEL,
        MAX_PIXELATION_LEVEL,
        DEFAULT_SETTINGS.pixelation_level
      )
    ),
    detailed_mode_enabled: Boolean(raw.detailed_mode_enabled)
  };
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function updateSettings(patch = {}) {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await chrome.storage.local.set(next);
  return next;
}

export async function ensureSettingsBootstrapped() {
  const current = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const needsBootstrap = Object.keys(DEFAULT_SETTINGS).some(
    (key) => current[key] === undefined
  );
  if (needsBootstrap) {
    await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...current });
  }
}
