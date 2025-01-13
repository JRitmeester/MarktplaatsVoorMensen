document.addEventListener('DOMContentLoaded', function() {
    // Get checkboxes
    const companyAdsCheckbox = document.getElementById('hideCompanyAds');
    const opvalAdsCheckbox = document.getElementById('hideOpvalAds');
    const dagtopperAdsCheckbox = document.getElementById('hideDagtopperAds');

    // Load saved settings
    chrome.storage.sync.get(['hideCompanyAds', 'hideOpvalAds', 'hideDagtopperAds'], function(data) {
        companyAdsCheckbox.checked = data.hideCompanyAds || false;
        opvalAdsCheckbox.checked = data.hideOpvalAds || false;
        dagtopperAdsCheckbox.checked = data.hideDagtopperAds || false;
    });

    // Function to update settings and trigger content script
    const updateSettings = function(setting, value) {
        // Save to storage
        chrome.storage.sync.set({ [setting]: value });
        
        // Send message to content script to refresh
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "refreshListings" });
        });
    };

    // Save settings when checkboxes are clicked
    companyAdsCheckbox.addEventListener('change', function() {
        updateSettings('hideCompanyAds', this.checked);
    });

    opvalAdsCheckbox.addEventListener('change', function() {
        updateSettings('hideOpvalAds', this.checked);
    });

    dagtopperAdsCheckbox.addEventListener('change', function() {
        updateSettings('hideDagtopperAds', this.checked);
    });
}); 