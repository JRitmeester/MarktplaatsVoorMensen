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

// Sellers without a real location are usually businesses.
const LOCATION_SELECTOR =
  '[class*="hz-Listing-location"], [data-testid="location-label"]';
const NATIONWIDE_LOCATION = "heel nederland";

const BANNER_SELECTOR = '[class*="hz-Banner"]';

// Marktplaats paginates before we filter, so a page can end up nearly empty.
// When that happens we fetch the next page(s) and append their listings.
const NEXT_PAGE_LINK_SELECTOR = 'a[aria-label="Volgende"]';
const LISTINGS_LIST_SELECTOR = 'ul[class*="hz-Listings"]';
const MIN_VISIBLE_LISTINGS = 10;
const MAX_EXTRA_PAGES = 5;
const PAGE_DIVIDER_CLASS = "mvm-page-divider";
const EXHAUSTED_ATTRIBUTE = "data-mvm-exhausted";

const isCompanyListing = (listing) =>
  listing.matches(ADMARKT_LISTING_SELECTOR) ||
  listing.querySelector(COMPANY_LINK_SELECTOR) !== null;

const hasOpvalSticker = (listing) =>
  listing.querySelector(OPVAL_SELECTOR) !== null;

const hasPriorityLabel = (listing) =>
  [...listing.querySelectorAll(PRIORITY_SELECTOR)].some((element) =>
    PRIORITY_LABELS.some((label) => element.textContent.includes(label))
  );

const hasNationwideLocation = (listing) =>
  [...listing.querySelectorAll(LOCATION_SELECTOR)].some(
    (element) => element.textContent.trim().toLowerCase() === NATIONWIDE_LOCATION
  );

const shouldHide = (listing, settings) =>
  (settings.hideCompanyAds && isCompanyListing(listing)) ||
  (settings.hideOpvalAds && hasOpvalSticker(listing)) ||
  (settings.hideDagtopperAds && hasPriorityLabel(listing)) ||
  (settings.hideHeelNederlandAds && hasNationwideLocation(listing));

const hide = (element) => {
  element.style.display = "none";
};

const isVisible = (element) => element.style.display !== "none";

const countVisibleListings = () =>
  [...document.querySelectorAll(LISTING_SELECTOR)].filter(isVisible).length;

// The main results list, as opposed to a Marktplaats Pro block.
const findMainList = (root) =>
  [...root.querySelectorAll(LISTINGS_LIST_SELECTOR)].find(
    (list) =>
      !list.closest(ADMARKT_CONTAINER_SELECTOR) &&
      list.querySelector(LISTING_SELECTOR) !== null
  );

const pageNumberFromUrl = (url) => {
  const match = url.match(/\/p\/(\d+)\//);
  return match ? Number(match[1]) : 1;
};

const createPageDivider = (pageNumber) => {
  const divider = document.createElement("li");
  divider.className = PAGE_DIVIDER_CLASS;
  divider.textContent = `Pagina ${pageNumber}`;
  divider.style.cssText =
    "list-style:none;padding:12px 0 4px;font-weight:bold;color:#767676;";
  return divider;
};

const fetchPage = async (url) => {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Pagina ophalen mislukt (${response.status}): ${url}`);
  }
  return new DOMParser().parseFromString(await response.text(), "text/html");
};

const appendListingsFrom = (pageDocument, pageNumber) => {
  const target = findMainList(document);
  const source = findMainList(pageDocument);
  if (!target || !source) {
    return 0;
  }
  const listings = [...source.querySelectorAll(LISTING_SELECTOR)];
  target.appendChild(createPageDivider(pageNumber));
  listings.forEach((listing) => target.appendChild(document.adoptNode(listing)));
  return listings.length;
};

// Point "Volgende" past the pages we already pulled in.
const updateNextPageLinks = (pageDocument) => {
  const nextLink = pageDocument.querySelector(NEXT_PAGE_LINK_SELECTOR);
  const nextHref = nextLink ? nextLink.getAttribute("href") : null;
  document.querySelectorAll(NEXT_PAGE_LINK_SELECTOR).forEach((link) => {
    if (nextHref) {
      link.setAttribute("href", nextHref);
    } else {
      link.setAttribute(EXHAUSTED_ATTRIBUTE, "true");
      hide(link);
    }
  });
};

const findNextPageLink = () => {
  const link = document.querySelector(NEXT_PAGE_LINK_SELECTOR);
  return link && !link.hasAttribute(EXHAUSTED_ATTRIBUTE) ? link : null;
};

const currentPageKey = () => `${location.pathname}${location.search}`;

// Replaced as a whole on every change, never mutated in place.
let pageState = { key: null, loading: false, pagesLoaded: 0 };

const resetPageStateIfNavigated = () => {
  if (pageState.key !== currentPageKey()) {
    pageState = { key: currentPageKey(), loading: false, pagesLoaded: 0 };
  }
};

const shouldLoadNextPage = (settings) =>
  settings.loadMorePages &&
  !pageState.loading &&
  pageState.pagesLoaded < MAX_EXTRA_PAGES &&
  countVisibleListings() < MIN_VISIBLE_LISTINGS &&
  findNextPageLink() !== null;

const loadNextPageIfSparse = async (settings) => {
  resetPageStateIfNavigated();
  if (!shouldLoadNextPage(settings)) {
    return;
  }
  const url = findNextPageLink().href;
  pageState = { ...pageState, loading: true };
  try {
    const pageDocument = await fetchPage(url);
    appendListingsFrom(pageDocument, pageNumberFromUrl(url));
    updateNextPageLinks(pageDocument);
    pageState = {
      ...pageState,
      loading: false,
      pagesLoaded: pageState.pagesLoaded + 1,
    };
  } catch (error) {
    console.error("[Marktplaats voor mensen] Doorladen gestopt:", error);
    pageState = { ...pageState, loading: false, pagesLoaded: MAX_EXTRA_PAGES };
  }
  processListings(settings);
};

const processListings = (settings) => {
  const listings = [...document.querySelectorAll(LISTING_SELECTOR)];
  listings.filter((listing) => shouldHide(listing, settings)).forEach(hide);

  if (settings.hideCompanyAds) {
    document.querySelectorAll(ADMARKT_CONTAINER_SELECTOR).forEach(hide);
  }

  // Banners only take up empty space once their listings are hidden.
  document.querySelectorAll(BANNER_SELECTOR).forEach(hide);

  loadNextPageIfSparse(settings);
};

const FILTER_KEYS = [
  "hideCompanyAds",
  "hideOpvalAds",
  "hideDagtopperAds",
  "hideHeelNederlandAds",
];
const SETTING_KEYS = [...FILTER_KEYS, "loadMorePages"];

chrome.storage.sync.get(SETTING_KEYS, (settings) => {
  const anyEnabled = FILTER_KEYS.some((key) => settings[key]);
  if (!anyEnabled) {
    return;
  }

  processListings(settings);

  const observer = new MutationObserver(() => processListings(settings));
  observer.observe(document.body, { childList: true, subtree: true });
});
