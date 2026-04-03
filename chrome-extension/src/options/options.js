import { MESSAGE } from "../shared/constants.js";

const SLIDER_FIELDS = ["confidence_percent", "overlay_opacity", "pixelation_level"];
const TOGGLE_FIELDS = [
  "power_mode_enabled",
  "full_screen_mode_enabled",
  "detailed_mode_enabled"
];

function setValueLabel(field, value) {
  const label = document.getElementById(`${field}_value`);
  if (!label) {
    return;
  }
  if (field.endsWith("percent") || field.endsWith("opacity")) {
    label.textContent = `${Math.round(value)}%`;
    return;
  }
  label.textContent = String(Math.round(value));
}

async function bootstrap() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE.GET_SETTINGS });
  const settings = response.settings || {};

  for (const field of SLIDER_FIELDS) {
    const input = document.getElementById(field);
    input.value = String(settings[field] ?? input.min ?? 0);
    setValueLabel(field, Number(input.value));
    input.addEventListener("input", async () => {
      setValueLabel(field, Number(input.value));
      await chrome.runtime.sendMessage({
        type: MESSAGE.UPDATE_SETTINGS,
        patch: { [field]: Number(input.value) }
      });
    });
  }

  for (const field of TOGGLE_FIELDS) {
    const input = document.getElementById(field);
    input.checked = Boolean(settings[field]);
    input.addEventListener("change", async () => {
      await chrome.runtime.sendMessage({
        type: MESSAGE.UPDATE_SETTINGS,
        patch: { [field]: input.checked }
      });
    });
  }
}

bootstrap().catch(() => {});
