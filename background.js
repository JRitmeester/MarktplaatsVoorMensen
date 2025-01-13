chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({
        hideCompanyAds: true,
        hideOpvalAds: true,
        hideDagtopperAds: true
    });
});
