// Loads another results page as a document whose listings can be taken over.
//
// Marktplaats keeps search filters (search text, price, distance, ...) behind
// the "#" of the URL. A browser never sends that part to the server, so the
// HTML the server returns is always the unfiltered page; Marktplaats' own
// script applies the filters afterwards. Fetching the HTML is therefore only
// right when there are no filters. With filters the page is opened in a
// hidden frame and read once Marktplaats has filtered it there.
const SEARCH_API_PATH = "/lrp/api/search";
const PAGINATION_SELECTOR = '[class*="hz-PaginationControls"]';
const FRAME_ATTRIBUTE = "data-mvm-page-frame";
// Scripts must run for the filters to apply; nothing else is allowed, so the
// framed page cannot navigate this tab or open windows.
const FRAME_SANDBOX = "allow-scripts allow-same-origin";
const FRAME_STYLE =
  "position:fixed;left:-10000px;top:0;width:1280px;height:900px;visibility:hidden;border:0;";
const FRAME_POLL_MS = 100;
const FRAME_TIMEOUT_MS = 15000;
// Fallback waits for when a signal cannot be observed directly.
const RENDER_GRACE_MS = 1500;
const PAGINATION_GRACE_MS = 3000;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchPageDocument = async (url) => {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Pagina ophalen mislukt (${response.status}): ${url}`);
  }
  return new DOMParser().parseFromString(await response.text(), "text/html");
};

const isFinishedSearchRequest = (entry) => {
  try {
    const url = new URL(entry.name);
    return (
      url.origin === location.origin &&
      url.pathname === SEARCH_API_PATH &&
      entry.responseEnd > 0
    );
  } catch (error) {
    return false;
  }
};

// The search requests Marktplaats' script has completed in a window. Empty
// when the browser does not expose them; callers then rely on the page itself.
const finishedSearchRequests = (view) => {
  try {
    return view.performance
      .getEntriesByType("resource")
      .filter(isFinishedSearchRequest)
      .map((entry) => entry.name);
  } catch (error) {
    return [];
  }
};

const createPageFrame = (url) => {
  const frame = document.createElement("iframe");
  frame.setAttribute(FRAME_ATTRIBUTE, "true");
  frame.setAttribute("sandbox", FRAME_SANDBOX);
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = FRAME_STYLE;
  frame.src = url;
  return frame;
};

const readFrame = (frame, listingSelector) => {
  const frameDocument = frame.contentDocument;
  return {
    listings: frameDocument ? [...frameDocument.querySelectorAll(listingSelector)] : [],
    hasPagination:
      frameDocument !== null &&
      frameDocument.querySelector(PAGINATION_SELECTOR) !== null,
  };
};

const INITIAL_FRAME_PROGRESS = Object.freeze({
  serverListings: null,
  replaced: false,
  filteredSince: null,
  listingCount: -1,
  stable: false,
});

// Filtering shows in two ways: the search request has finished, or the
// listings the server sent have been replaced by others.
const nextFrameProgress = (progress, frame, snapshot, now) => {
  const serverListings =
    progress.serverListings ??
    (snapshot.listings.length > 0 ? snapshot.listings : null);
  const replaced =
    serverListings !== null &&
    serverListings.some((listing) => !listing.isConnected);
  const filtered =
    replaced || finishedSearchRequests(frame.contentWindow).length > 0;
  return {
    serverListings,
    replaced,
    filteredSince: progress.filteredSince ?? (filtered ? now : null),
    listingCount: snapshot.listings.length,
    stable: progress.listingCount === snapshot.listings.length,
  };
};

const isFrameSettled = (progress, snapshot, now) => {
  if (progress.filteredSince === null || !progress.stable) {
    return false;
  }
  const waited = now - progress.filteredSince;
  return (
    (progress.replaced || waited >= RENDER_GRACE_MS) &&
    (snapshot.hasPagination || waited >= PAGINATION_GRACE_MS)
  );
};

// Resolves with the frame's document once Marktplaats has filtered it. An
// unfiltered page is never handed out: without a sign of filtering this fails.
const waitForFilteredFrame = async (frame, listingSelector) => {
  const deadline = Date.now() + FRAME_TIMEOUT_MS;
  let progress = INITIAL_FRAME_PROGRESS;
  while (Date.now() < deadline) {
    await wait(FRAME_POLL_MS);
    const now = Date.now();
    const snapshot = readFrame(frame, listingSelector);
    progress = nextFrameProgress(progress, frame, snapshot, now);
    if (isFrameSettled(progress, snapshot, now)) {
      return frame.contentDocument;
    }
  }
  throw new Error(`Gefilterde pagina niet op tijd geladen: ${frame.src}`);
};

const linksForFrame = (frame) => {
  const requests = finishedSearchRequests(frame.contentWindow);
  return requests.length > 0
    ? linksFromSearchApi(requests[requests.length - 1])
    : Promise.resolve(EMPTY_LINKS);
};

// Calls use(pageDocument, links) while the page is available and returns its
// result. The frame, when one is needed, is removed afterwards.
const withPageDocument = async (url, listingSelector, use) => {
  if (new URL(url).hash === "") {
    const pageDocument = await fetchPageDocument(url);
    return use(pageDocument, linksFromNextData(pageDocument));
  }
  const frame = createPageFrame(url);
  document.body.appendChild(frame);
  try {
    const pageDocument = await waitForFilteredFrame(frame, listingSelector);
    return use(pageDocument, await linksForFrame(frame));
  } finally {
    frame.remove();
  }
};
