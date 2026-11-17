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

// A price of "Zie omschrijving" instead of an amount is common for businesses.
// The selector also matches wrappers around the price, hence the exact text.
const PRICE_SELECTOR = '[class*="ListingPrice_"], [class*="hz-Listing-price"]';
const SEE_DESCRIPTION_PRICE = "zie omschrijving";

// Banner slots, including the empty placeholder that Marktplaats keeps 250px
// high while a banner loads. Once the listings around them are hidden they
// only leave a white gap.
const BANNER_SELECTOR = '[class*="hz-Banner"], li[class*="bannerContainer"]';

// Marktplaats paginates before we filter, so a page can end up nearly empty.
// When that happens the next page(s) are loaded (see page-loader.js) and
// their listings are appended.
const NEXT_PAGE_LINK_SELECTOR = 'a[aria-label="Volgende"]';
const LISTINGS_LIST_SELECTOR = 'ul[class*="hz-Listings"]';
const MIN_VISIBLE_LISTINGS = 10;
const MAX_EXTRA_PAGES = 5;
const PAGE_DIVIDER_CLASS = "mvm-page-divider";
const EXHAUSTED_ATTRIBUTE = "data-mvm-exhausted";
// Marks what this extension hid, so it can be shown again when settings change.
const HIDDEN_ATTRIBUTE = "data-mvm-hidden";

const FILTER_KEYS = [
  "hideCompanyAds",
  "hideOpvalAds",
  "hideDagtopperAds",
  "hideHeelNederlandAds",
  "hideSeeDescriptionAds",
];

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

// "filters" is the validated settings plus the text filter built from them.
const createFilters = (settings) =>
  Object.freeze({ settings, textFilter: createTextFilter(settings) });

const isAnyFilterActive = ({ settings, textFilter }) =>
  FILTER_KEYS.some((key) => settings[key]) || textFilter !== null;

const hasSeeDescriptionPrice = (listing) =>
  [...listing.querySelectorAll(PRICE_SELECTOR)].some(
    (element) => element.textContent.trim().toLowerCase() === SEE_DESCRIPTION_PRICE
  );

const shouldHide = (listing, { settings, textFilter }) =>
  (settings.hideCompanyAds && isCompanyListing(listing)) ||
  (settings.hideOpvalAds && hasOpvalSticker(listing)) ||
  (settings.hideDagtopperAds && hasPriorityLabel(listing)) ||
  (settings.hideHeelNederlandAds && hasNationwideLocation(listing)) ||
  (settings.hideSeeDescriptionAds && hasSeeDescriptionPrice(listing)) ||
  (textFilter !== null && textFilter.lacksRequiredText(listing));

const hide = (element) => {
  if (element.style.display === "none") {
    return;
  }
  element.style.display = "none";
  element.setAttribute(HIDDEN_ATTRIBUTE, "true");
};

const unhideAll = () => {
  document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((element) => {
    element.style.display = "";
    element.removeAttribute(HIDDEN_ATTRIBUTE);
  });
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

const PAGE_PATH_PATTERN = /\/p\/(\d+)\//;
const PAGE_COUNT_PATTERN = /Pagina\s+(\d+)\s+van\s+(\d+)/;
// Marks the divider and the listings this extension added from later pages.
const LOADED_ATTRIBUTE = "data-mvm-loaded";
// With search filters Marktplaats first shows the unfiltered page and then
// redraws the list. Later pages are only added once that has had time to
// happen, so they end up below the redrawn list instead of inside it.
const FILTER_SETTLE_MS = 2500;

const pageNumberFromPath = (pathname) => {
  const match = pathname.match(PAGE_PATH_PATTERN);
  return match ? Number(match[1]) : 1;
};

const pathForPage = (pathname, pageNumber) =>
  PAGE_PATH_PATTERN.test(pathname)
    ? pathname.replace(PAGE_PATH_PATTERN, `/p/${pageNumber}/`)
    : `${pathname.replace(/\/?$/, "/")}p/${pageNumber}/`;

// Built from the address bar, not from Marktplaats' "Volgende" link: that
// link does not always carry the search filters, and they must come along.
const urlForPage = (pageNumber) =>
  `${location.origin}${pathForPage(location.pathname, pageNumber)}` +
  `${location.search}${location.hash}`;

const createPageDivider = (pageNumber) => {
  const divider = document.createElement("li");
  divider.className = PAGE_DIVIDER_CLASS;
  divider.setAttribute(LOADED_ATTRIBUTE, "true");
  divider.textContent = `Pagina ${pageNumber}`;
  divider.style.cssText =
    "list-style:none;padding:12px 0 4px;font-weight:bold;color:#767676;";
  return divider;
};

const appendListingsFrom = (pageDocument, links, pageNumber) => {
  const target = findMainList(document);
  const source = findMainList(pageDocument);
  if (!target || !source) {
    return 0;
  }
  const listings = [...source.querySelectorAll(LISTING_SELECTOR)];
  if (listings.length === 0) {
    return 0;
  }
  target.appendChild(createPageDivider(pageNumber));
  listings.forEach((listing) => {
    const adopted = document.adoptNode(listing);
    adopted.setAttribute(LOADED_ATTRIBUTE, "true");
    restoreMissingLinks(adopted, links);
    target.appendChild(adopted);
  });
  return listings.length;
};

const isLastPage = (pageDocument) => {
  const pagination = pageDocument.querySelector(PAGINATION_SELECTOR);
  const match = pagination ? pagination.textContent.match(PAGE_COUNT_PATTERN) : null;
  return match !== null && Number(match[1]) >= Number(match[2]);
};

const hasNextPage = (pageDocument) =>
  pageDocument.querySelector(NEXT_PAGE_LINK_SELECTOR) !== null &&
  !isLastPage(pageDocument);

// Point "Volgende" past the pages we already pulled in, or hide it at the end.
const updateNextPageLinks = (nextUrl) => {
  document.querySelectorAll(NEXT_PAGE_LINK_SELECTOR).forEach((link) => {
    if (nextUrl !== null) {
      link.setAttribute("href", nextUrl);
    } else {
      // Not via hide(): this must stay hidden when settings change.
      link.setAttribute(EXHAUSTED_ATTRIBUTE, "true");
      link.style.display = "none";
    }
  });
};

const findNextPageLink = () => {
  const link = document.querySelector(NEXT_PAGE_LINK_SELECTOR);
  return link && !link.hasAttribute(EXHAUSTED_ATTRIBUTE) ? link : null;
};

// The part after "#" holds the search filters, so it is part of the key.
const currentPageKey = () =>
  `${location.pathname}${location.search}${location.hash}`;

// Pages added for an earlier search do not belong to the current one.
const removeLoadedPages = () => {
  document
    .querySelectorAll(`[${LOADED_ATTRIBUTE}]`)
    .forEach((element) => element.remove());
  document.querySelectorAll(`[${EXHAUSTED_ATTRIBUTE}]`).forEach((link) => {
    link.removeAttribute(EXHAUSTED_ATTRIBUTE);
    link.style.display = "";
  });
};

// Replaced as a whole on every change, never mutated in place.
let pageState = { key: null, loading: false, pagesLoaded: 0, since: 0 };

const resetPageStateIfNavigated = () => {
  if (pageState.key === currentPageKey()) {
    return;
  }
  if (pageState.key !== null) {
    removeLoadedPages();
  }
  pageState = {
    key: currentPageKey(),
    loading: false,
    pagesLoaded: 0,
    since: Date.now(),
  };
  if (location.hash !== "") {
    // Nothing else may wake us up once Marktplaats is done redrawing.
    setTimeout(() => processListings(activeFilters), FILTER_SETTLE_MS + 50);
  }
};

const mainPageHasSettled = () =>
  location.hash === "" || Date.now() - pageState.since >= FILTER_SETTLE_MS;

const shouldLoadNextPage = (settings) =>
  settings.loadMorePages &&
  !pageState.loading &&
  pageState.pagesLoaded < MAX_EXTRA_PAGES &&
  mainPageHasSettled() &&
  countVisibleListings() < MIN_VISIBLE_LISTINGS &&
  findNextPageLink() !== null;

const loadPageInto = async (pageNumber, key) => {
  try {
    return await withPageDocument(
      urlForPage(pageNumber),
      LISTING_SELECTOR,
      (pageDocument, links) =>
        currentPageKey() === key
          ? {
              added: appendListingsFrom(pageDocument, links, pageNumber),
              hasNext: hasNextPage(pageDocument),
            }
          : null
    );
  } catch (error) {
    console.error("[Marktplaats voor mensen] Doorladen gestopt:", error);
    return { added: 0, hasNext: false, failed: true };
  }
};

const loadNextPageIfSparse = async (settings) => {
  resetPageStateIfNavigated();
  if (!shouldLoadNextPage(settings)) {
    return;
  }
  const key = pageState.key;
  const pageNumber =
    pageNumberFromPath(location.pathname) + pageState.pagesLoaded + 1;
  pageState = { ...pageState, loading: true };

  const outcome = await loadPageInto(pageNumber, key);

  // The user moved on to another search meanwhile: this result is not theirs.
  if (outcome !== null && pageState.key === key && currentPageKey() === key) {
    const hasMore = outcome.added > 0 && outcome.hasNext;
    if (!outcome.failed) {
      updateNextPageLinks(hasMore ? urlForPage(pageNumber + 1) : null);
    }
    pageState = {
      ...pageState,
      loading: false,
      pagesLoaded: hasMore ? pageState.pagesLoaded + 1 : MAX_EXTRA_PAGES,
    };
  }
  // Settings may have changed while the page was being loaded.
  processListings(activeFilters);
};

const clearTextFilter = () => {
  chrome.storage.sync.set({ requiredText: "" });
};

const processListings = (filters) => {
  if (filters === null) {
    return;
  }
  syncTextFilterNotice(filters.textFilter, findMainList(document), clearTextFilter);
  if (!isAnyFilterActive(filters)) {
    return;
  }

  const listings = [...document.querySelectorAll(LISTING_SELECTOR)];
  listings.filter((listing) => shouldHide(listing, filters)).forEach(hide);

  if (filters.settings.hideCompanyAds) {
    document.querySelectorAll(ADMARKT_CONTAINER_SELECTOR).forEach(hide);
  }

  // Banners only take up empty space once their listings are hidden.
  document.querySelectorAll(BANNER_SELECTOR).forEach(hide);

  loadNextPageIfSparse(filters.settings);
};

// Replaced as a whole whenever the stored settings change, never mutated.
let activeFilters = null;

const applySettings = (stored) => {
  if (chrome.runtime.lastError) {
    console.error(
      "[Marktplaats voor mensen] Instellingen lezen mislukt, standaardwaarden gebruikt:",
      chrome.runtime.lastError
    );
  }
  activeFilters = createFilters(normalizeSettings(stored));
  unhideAll();
  processListings(activeFilters);
};

const loadSettings = () => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);
};

loadSettings();

const observer = new MutationObserver(() => processListings(activeFilters));
observer.observe(document.body, { childList: true, subtree: true });

// Changes made in the popup or options page apply without a reload.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    loadSettings();
  }
});
