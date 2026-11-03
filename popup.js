const SETTING_IDS = [
  "hideCompanyAds",
  "hideOpvalAds",
  "hideDagtopperAds",
  "hideHeelNederlandAds",
  "loadMorePages",
];

const refreshActiveTab = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "refreshListings" });
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(SETTING_IDS, (settings) => {
    SETTING_IDS.forEach((id) => {
      document.getElementById(id).checked = Boolean(settings[id]);
    });
  });

  SETTING_IDS.forEach((id) => {
    document.getElementById(id).addEventListener("change", (event) => {
      chrome.storage.sync.set({ [id]: event.target.checked });
      refreshActiveTab();
    });
  });
});
