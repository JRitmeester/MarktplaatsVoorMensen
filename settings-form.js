// Shared by the popup and the options page: every form control whose id is a
// setting name is filled from storage and saved as soon as it changes. The
// content script picks the change up by itself, no reload needed.
const SAVE_FAILED_MESSAGE = "Opslaan mislukt. Probeer het opnieuw.";
const LOAD_FAILED_MESSAGE = "Instellingen laden mislukt.";

const controlValue = (control) =>
  control.type === "checkbox" ? control.checked : control.value;

const showControlValue = (control, value) => {
  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = String(value);
  }
};

const reportStatus = (message) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
  }
};

const saveControl = (control) => {
  chrome.storage.sync.set({ [control.id]: controlValue(control) }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error("[Marktplaats voor mensen] Opslaan mislukt:", error);
    }
    reportStatus(error ? SAVE_FAILED_MESSAGE : "");
  });
};

const initSettingsForm = () => {
  const controls = Object.keys(DEFAULT_SETTINGS)
    .map((id) => document.getElementById(id))
    .filter((control) => control !== null);

  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error("[Marktplaats voor mensen] Laden mislukt:", error);
      reportStatus(LOAD_FAILED_MESSAGE);
    }
    const settings = normalizeSettings(stored);
    controls.forEach((control) => showControlValue(control, settings[control.id]));
  });

  controls.forEach((control) => {
    const eventName = control.type === "text" ? "input" : "change";
    control.addEventListener(eventName, () => saveControl(control));
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsForm);
} else {
  initSettingsForm();
}
