// Marktplaats draws some listings with a link that has no href and opens the
// listing from a script instead. Listings taken over from another page lose
// that script, so they could not be clicked. The address is still part of the
// search results data; this file puts it back on the link.
const COVER_LINK_SELECTOR = 'a[class*="coverLink"]';
const IMAGE_ID_PATTERN = /\/images\/(?:[0-9a-f]{2}\/)?([0-9a-f-]{36})/i;
const NEXT_DATA_ID = "__NEXT_DATA__";
const EMPTY_LINKS = Object.freeze({ byImage: new Map(), byTitle: new Map() });

const imageIdFrom = (url) => {
  const match = typeof url === "string" ? url.match(IMAGE_ID_PATTERN) : null;
  return match ? match[1].toLowerCase() : null;
};

const titleKey = (title) => title.replace(/\s+/g, " ").trim().toLowerCase();

// The results data is external input: only paths on this site are accepted.
const safeListingPath = (vipUrl) => {
  if (typeof vipUrl !== "string" || !vipUrl.startsWith("/")) {
    return null;
  }
  try {
    const url = new URL(vipUrl, location.origin);
    return url.origin === location.origin ? `${url.pathname}${url.search}` : null;
  } catch (error) {
    return null;
  }
};

const imageIdsOf = (entry) =>
  [
    ...(Array.isArray(entry.imageUrls) ? entry.imageUrls : []),
    ...(Array.isArray(entry.pictures) ? entry.pictures.map((picture) => picture && picture.url) : []),
  ]
    .map(imageIdFrom)
    .filter((id) => id !== null);

const resultEntries = (searchResponse) => {
  if (!searchResponse || typeof searchResponse !== "object") {
    return [];
  }
  return [searchResponse.listings, searchResponse.topBlock]
    .filter(Array.isArray)
    .flat()
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      path: safeListingPath(entry.vipUrl),
      title: typeof entry.title === "string" ? titleKey(entry.title) : null,
      imageIds: imageIdsOf(entry),
    }))
    .filter((entry) => entry.path !== null);
};

// A listing is recognised by its photo, or by its title when that is unique.
const createListingLinks = (searchResponse) => {
  const entries = resultEntries(searchResponse);
  const hasUniqueTitle = (entry) =>
    entry.title !== null &&
    entries.filter((other) => other.title === entry.title).length === 1;
  return Object.freeze({
    byImage: new Map(
      entries.flatMap((entry) => entry.imageIds.map((id) => [id, entry.path]))
    ),
    byTitle: new Map(
      entries.filter(hasUniqueTitle).map((entry) => [entry.title, entry.path])
    ),
  });
};

// Results as embedded by the server in a page that was fetched as HTML.
const linksFromNextData = (pageDocument) => {
  const script = pageDocument.getElementById(NEXT_DATA_ID);
  if (!script) {
    return EMPTY_LINKS;
  }
  try {
    const data = JSON.parse(script.textContent);
    return createListingLinks(data?.props?.pageProps?.searchRequestAndResponse);
  } catch (error) {
    console.error("[Marktplaats voor mensen] Advertentielinks lezen mislukt:", error);
    return EMPTY_LINKS;
  }
};

// Results as Marktplaats' own script requested them for a filtered page.
const linksFromSearchApi = async (apiUrl) => {
  try {
    const response = await fetch(apiUrl, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    return createListingLinks(await response.json());
  } catch (error) {
    console.error("[Marktplaats voor mensen] Advertentielinks ophalen mislukt:", error);
    return EMPTY_LINKS;
  }
};

const linkFor = (listing, links) => {
  const byImage = [...listing.querySelectorAll("img")]
    .map((image) => imageIdFrom(image.getAttribute("src") || image.getAttribute("data-src")))
    .map((id) => (id === null ? undefined : links.byImage.get(id)))
    .find((path) => path !== undefined);
  if (byImage !== undefined) {
    return byImage;
  }
  const title = listing.querySelector(TITLE_SELECTOR);
  return title ? links.byTitle.get(titleKey(title.textContent)) ?? null : null;
};

const restoreMissingLinks = (listing, links) => {
  const anchors = [...listing.querySelectorAll(COVER_LINK_SELECTOR)].filter(
    (anchor) => !anchor.hasAttribute("href")
  );
  if (anchors.length === 0) {
    return;
  }
  const path = linkFor(listing, links);
  if (path !== null) {
    anchors.forEach((anchor) => anchor.setAttribute("href", path));
  }
};
