document.addEventListener('DOMContentLoaded', function() {
    // Company ads checkbox
    const companyCheckbox = document.getElementById('hideCompanyAds');
    chrome.storage.sync.get('hideCompanyAds', function(data) {
        companyCheckbox.checked = data.hideCompanyAds || true;
    });
    companyCheckbox.onchange = function() {
        chrome.storage.sync.set({'hideCompanyAds': companyCheckbox.checked});
    };

    // Opval ads checkbox
    const opvalCheckbox = document.getElementById('hideOpvalAds');
    chrome.storage.sync.get('hideOpvalAds', function(data) {
        opvalCheckbox.checked = data.hideOpvalAds || true;
    });
    opvalCheckbox.onchange = function() {
        chrome.storage.sync.set({'hideOpvalAds': opvalCheckbox.checked});
    };

    // Dagtopper ads checkbox
    const dagtopperCheckbox = document.getElementById('hideDagtopperAds');
    chrome.storage.sync.get('hideDagtopperAds', function(data) {
        dagtopperCheckbox.checked = data.hideDagtopperAds || true;
    });
    dagtopperCheckbox.onchange = function() {
        chrome.storage.sync.set({'hideDagtopperAds': dagtopperCheckbox.checked});
    };
});
