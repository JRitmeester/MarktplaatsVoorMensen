importScripts("settings.js");

// Only fill in settings that are not stored yet, so an update of the
// extension never resets the user's own choices.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (stored) => {
    if (chrome.runtime.lastError) {
      console.error("[Marktplaats voor mensen] Instellingen lezen mislukt:", chrome.runtime.lastError);
      return;
    }
    chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...stored });
  });
});
