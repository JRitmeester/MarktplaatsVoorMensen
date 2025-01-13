chrome.storage.sync.get(
  ["hideCompanyAds", "hideOpvalAds", "hideDagtopperAds"],
  function (data) {
    // Process listings if any option is enabled
    if (data.hideCompanyAds || data.hideOpvalAds || data.hideDagtopperAds) {
      // Function to process listings
      const processListings = () => {
        const listings = document.querySelectorAll(
          "li.hz-Listing--gallery-item"
        );
        var companyCount = 0;
        var opvalCount = 0;
        var dagtopperCount = 0;

        const to_be_removed = [];
        listings.forEach((listing) => {
          let shouldRemove = false;

          // Check for company ads
          if (data.hideCompanyAds) {
            const anchorTag = listing.querySelector(
              "span.hz-Listing-seller-link a"
            );
            if (anchorTag) {
              shouldRemove = true;
              companyCount++;
            }
          }

          // Check for Opvalsticker
          if (data.hideOpvalAds) {
            const opvalSticker = listing.querySelector(
              ".hz-Listing-Opvalsticker"
            );
            if (opvalSticker) {
              shouldRemove = true;
              opvalCount++;
            }
          }

          // Check for Dagtopper
          if (data.hideDagtopperAds) {
            const dagtopperDiv = listing.querySelector(".hz-Listing-priority");
            if (
              dagtopperDiv &&
              dagtopperDiv.textContent.includes("Dagtopper")
            ) {
              shouldRemove = true;
              dagtopperCount++;
            }
          }

          if (shouldRemove) {
            to_be_removed.push(listing);
          }
        });

        to_be_removed.forEach((listing) => {
          listing.style.display = "none";
        });

        // Remove any div with the class "hz-Banner" that just takes up empty space.
        const banners = document.querySelectorAll(".hz-Banner");
        banners.forEach((banner) => {
          banner.style.display = "none";
        });
      };

      // Initial check
      processListings();

      // Create an observer to watch for changes
      const observer = new MutationObserver(processListings);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }
);
