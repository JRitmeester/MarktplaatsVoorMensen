// Marktplaats has moved to CSS-module class names (e.g.
// "ListingPriority_hz-Listing-priority-new__CVWGl"), so every selector below
// matches on a class-name substring instead of an exact class.
const LISTING_SELECTOR =
  'li[class*="hz-Listing--gallery-item"], li[class*="hz-Listing--list-item"]';

const COMPANY_LINK_SELECTOR = [
  '[class*="hz-Listing-seller-link"] a',
  '[class*="hz-Listing-sellerLink"] a',
  '[class*="hz-Listing-seller-external-link"] a',
  'a[class*="sellerExternalLink"]',
].join(", ");

const OPVAL_SELECTOR =
  '[class*="Opvalsticker"], [data-testid="listing-opval-sticker"]';

const PRIORITY_SELECTOR = '[class*="hz-Listing-priority"]';
const PRIORITY_LABELS = ["Dagtopper", "Topadvertentie"];

// "Advertenties door Marktplaats Pro" blocks: the whole box, title included.
const ADMARKT_CONTAINER_SELECTOR =
  '[class*="hz-Listings__container--cas"], [data-testid="BottomBlockLazyListings"]';
const ADMARKT_LISTING_SELECTOR = '[class*="hz-Listing--cas"]';

const BANNER_SELECTOR = '[class*="hz-Banner"]';

const isCompanyListing = (listing) =>
  listing.matches(ADMARKT_LISTING_SELECTOR) ||
  listing.querySelector(COMPANY_LINK_SELECTOR) !== null;

const hasOpvalSticker = (listing) =>
  listing.querySelector(OPVAL_SELECTOR) !== null;

const hasPriorityLabel = (listing) =>
  [...listing.querySelectorAll(PRIORITY_SELECTOR)].some((element) =>
    PRIORITY_LABELS.some((label) => element.textContent.includes(label))
  );

const shouldHide = (listing, settings) =>
  (settings.hideCompanyAds && isCompanyListing(listing)) ||
  (settings.hideOpvalAds && hasOpvalSticker(listing)) ||
  (settings.hideDagtopperAds && hasPriorityLabel(listing));

const hide = (element) => {
  element.style.display = "none";
};

const processListings = (settings) => {
  const listings = [...document.querySelectorAll(LISTING_SELECTOR)];
  listings.filter((listing) => shouldHide(listing, settings)).forEach(hide);

  if (settings.hideCompanyAds) {
    document.querySelectorAll(ADMARKT_CONTAINER_SELECTOR).forEach(hide);
  }

  // Banners only take up empty space once their listings are hidden.
  document.querySelectorAll(BANNER_SELECTOR).forEach(hide);
};

chrome.storage.sync.get(
  ["hideCompanyAds", "hideOpvalAds", "hideDagtopperAds"],
  (settings) => {
    const anyEnabled =
      settings.hideCompanyAds ||
      settings.hideOpvalAds ||
      settings.hideDagtopperAds;
    if (!anyEnabled) {
      return;
    }

    processListings(settings);

    const observer = new MutationObserver(() => processListings(settings));
    observer.observe(document.body, { childList: true, subtree: true });
  }
);
