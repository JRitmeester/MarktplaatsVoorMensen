// Loads the extension's content scripts into a jsdom page with a stubbed
// chrome.storage and fetch, so the filters can be tested without a browser.
const fs = require("node:fs");
const path = require("node:path");
const { after } = require("node:test");
const { JSDOM, ResourceLoader } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const SETTLE_MS = 60;
const CLIENT_POLL_MS = 20;
// Longer than the extension's own poll interval, like on the real site.
const CLIENT_RENDER_MS = 300;

const ALL_OFF = Object.freeze({
  hideCompanyAds: false,
  hideOpvalAds: false,
  hideDagtopperAds: false,
  hideHeelNederlandAds: false,
  hideSeeDescriptionAds: false,
  loadMorePages: false,
  requiredText: "",
  requiredTextScope: "title",
  requiredTextWholeWords: true,
});

const LISTING_SELECTOR = 'li[class*="hz-Listing--"]';

// Windows keep timers alive; close them so a test file can finish at once.
const openWindows = [];
after(() => openWindows.forEach((window) => window.close()));

const readProjectFile = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");

// Top-level const declarations are only shared within a single eval, so the
// scripts are concatenated the way Chrome shares one scope between them.
// The file list comes from the manifest, so a script missing there fails here.
const contentScriptSource = () =>
  JSON.parse(readProjectFile("manifest.json"))
    .content_scripts[0].js.map(readProjectFile)
    .join("\n");

// Minimal chrome.storage.sync: get with defaults, set, and change listeners.
const createChromeStub = (initial) => {
  let stored = { ...initial };
  const listeners = [];
  const saved = [];
  return {
    saved,
    runtime: {},
    storage: {
      onChanged: { addListener: (listener) => listeners.push(listener) },
      sync: {
        get: (keys, callback) => {
          const defaults = keys && !Array.isArray(keys) ? keys : {};
          callback({ ...defaults, ...stored });
        },
        set: (values, callback) => {
          stored = { ...stored, ...values };
          saved.push(values);
          listeners.forEach((listener) => listener(values, "sync"));
          if (callback) {
            callback();
          }
        },
      },
    },
  };
};

const settle = (ms = SETTLE_MS) => new Promise((resolve) => setTimeout(resolve, ms));

// Serves the HTML the Marktplaats server would return: never filtered,
// because the part of a URL after "#" does not reach a server.
const createServer = (pages) => {
  class PageLoader extends ResourceLoader {
    fetch(url) {
      const body = pages[new URL(url).pathname];
      return body ? Promise.resolve(Buffer.from(body)) : Promise.reject(new Error(`404: ${url}`));
    }
  }
  return new PageLoader();
};

// A frame entry is the filtered page body, or { body, apiUrl } to also record
// the search request the way a real browser lists it.
const renderFiltered = (frame, filtered) => {
  const { body, apiUrl = null } = typeof filtered === "string" ? { body: filtered } : filtered;
  frame.contentDocument.body.innerHTML = body;
  if (apiUrl) {
    frame.contentWindow.performance.getEntriesByType = () => [
      { name: `https://www.marktplaats.nl${apiUrl}`, responseEnd: 5 },
    ];
  }
};

// Plays the part of Marktplaats' own script inside a frame: shortly after the
// server HTML is shown, it redraws the page for the filters behind the "#".
const simulateMarktplaatsClient = (window, frames) => {
  const handled = new WeakSet();
  // Timers of the window itself, so closing the window stops them.
  return window.setInterval(() => {
    window.document.querySelectorAll("iframe").forEach((frame) => {
      const frameDocument = frame.contentDocument;
      if (handled.has(frame) || !frameDocument || !frameDocument.querySelector(LISTING_SELECTOR)) {
        return;
      }
      handled.add(frame);
      const { pathname, hash } = frame.contentWindow.location;
      const filtered = frames[`${pathname}${hash}`];
      if (filtered) {
        window.setTimeout(() => renderFiltered(frame, filtered), CLIENT_RENDER_MS);
      }
    });
  }, CLIENT_POLL_MS);
};

// pages: server HTML per path. frames: filtered page body per path plus hash.
const loadPage = async ({
  html,
  stored = {},
  path: pagePath = "/q/test/",
  pages = {},
  frames = {},
  settleMs = SETTLE_MS,
}) => {
  const dom = new JSDOM(html, {
    url: `https://www.marktplaats.nl${pagePath}`,
    runScripts: "outside-only",
    resources: createServer(pages),
  });
  openWindows.push(dom.window);
  const fetched = [];
  dom.window.fetch = async (url) => {
    const fetchedPath = new URL(url).pathname;
    fetched.push(fetchedPath);
    const body = pages[fetchedPath];
    return {
      ok: Boolean(body),
      status: body ? 200 : 404,
      text: async () => body || "",
      json: async () => JSON.parse(body),
    };
  };
  dom.window.console.error = () => {};
  const chrome = createChromeStub({ ...ALL_OFF, ...stored });
  dom.window.chrome = chrome;
  simulateMarktplaatsClient(dom.window, frames);
  dom.window.eval(contentScriptSource());
  await settle(settleMs);
  const changeSettings = async (values) => {
    chrome.storage.sync.set(values);
    await settle();
  };
  return { window: dom.window, document: dom.window.document, fetched, changeSettings };
};

// Loads the popup or options page with its scripts and a stubbed storage.
const loadForm = async (htmlFile, stored = {}) => {
  const dom = new JSDOM(readProjectFile(htmlFile), { runScripts: "outside-only" });
  openWindows.push(dom.window);
  const chrome = createChromeStub(stored);
  dom.window.chrome = chrome;
  const scripts = [...dom.window.document.querySelectorAll("script[src]")];
  dom.window.eval(scripts.map((script) => readProjectFile(script.getAttribute("src"))).join("\n"));
  await settle();
  return { window: dom.window, document: dom.window.document, saved: chrome.saved };
};

const isHidden = (element) => element.style.display === "none";

const listings = (document) => [...document.querySelectorAll(LISTING_SELECTOR)];

// The page count labels a visitor can see below the results.
const pageCountLabels = (document) =>
  [...document.querySelectorAll('[class*="amountOfPages"]')]
    .filter((label) => !isHidden(label))
    .map((label) => label.textContent);

const visibleTitles = (document) =>
  listings(document)
    .filter((listing) => !isHidden(listing))
    .map((listing) => listing.querySelector('[class*="ListingTitle_"]').textContent);

// A listing in Marktplaats' current markup, reduced to what the filters read.
// "image" adds the cover link with a photo; "href" gives that link an address.
const coverLink = (image, href) =>
  image === null
    ? ""
    : `<a class="hz-Link ListingListViewContentDesktop_hz-Listing-coverLink__mlh5t"` +
      `${href === null ? "" : ` href="${href}"`} role="link">` +
      `<img data-src="https://images.marktplaats.com/api/v1/hz-mp-pro-listing/images/${image}?rule=x"></a>`;

const listing = ({ title, description = "", attributes = "", price = "€&nbsp;10,00", image = null, href = null }) =>
  `<li class="hz-Listing hz-Listing--list-item">` +
  coverLink(image, href) +
  `<div class="hz-title-description ListingTitleDescription_hz-Listing-title-description__FIeUa">` +
  `<span class="hz-Text ListingTitle_hz-Listing-title-new__nbyD0">${title}</span>` +
  `<span class="hz-Text ListingDescription_hz-Listing-description-new__ByE0c">${description}</span></div>` +
  `<span class="ListingAttribute_hz-Attribute__RHK5D">${attributes}</span>` +
  `<div class="hz-price-date-feature ListingPriceDateFeature_hz-Listing-price-date-feature__OWdxh">` +
  `<h5 class="hz-Title ListingPrice_hz-Listing-price__p3UvB">${price}</h5><span>Vandaag</span></div></li>`;

// Like Marktplaats: "Volgende" is a link while there is a next page and a
// plain button on the last page.
const pageBody = (listingsHtml, { nextHref = null, extra = "", pageCount = null } = {}) =>
  `<ul class="hz-Listings hz-Listings--list-view listings-container">${listingsHtml}</ul>` +
  extra +
  `<div class="hz-PaginationControls"><nav>` +
  (nextHref
    ? `<a aria-label="Volgende" href="${nextHref}">&gt;</a>`
    : `<button aria-label="Volgende">&gt;</button>`) +
  `</nav>` +
  (pageCount === null
    ? ""
    : `<span class="hz-Text hz-PaginationControls-pagination-amountOfPages">${pageCount}</span>`) +
  `</div>`;

const page = (listingsHtml, options) =>
  `<!doctype html><html><body>${pageBody(listingsHtml, options)}</body></html>`;

module.exports = {
  ALL_OFF,
  isHidden,
  listing,
  listings,
  loadForm,
  loadPage,
  page,
  pageBody,
  pageCountLabels,
  readProjectFile,
  visibleTitles,
};
