// Loads the extension's content scripts into a jsdom page with a stubbed
// chrome.storage and fetch, so the filters can be tested without a browser.
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const SETTLE_MS = 60;

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

const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

const loadPage = async ({ html, stored = {}, path: pagePath = "/q/test/", pages = {} }) => {
  const dom = new JSDOM(html, {
    url: `https://www.marktplaats.nl${pagePath}`,
    runScripts: "outside-only",
  });
  const fetched = [];
  dom.window.fetch = async (url) => {
    const fetchedPath = new URL(url).pathname;
    fetched.push(fetchedPath);
    const body = pages[fetchedPath];
    return { ok: Boolean(body), status: body ? 200 : 404, text: async () => body || "" };
  };
  dom.window.console.error = () => {};
  const chrome = createChromeStub({ ...ALL_OFF, ...stored });
  dom.window.chrome = chrome;
  dom.window.eval(contentScriptSource());
  await settle();
  const changeSettings = async (values) => {
    chrome.storage.sync.set(values);
    await settle();
  };
  return { document: dom.window.document, fetched, changeSettings };
};

// Loads the popup or options page with its scripts and a stubbed storage.
const loadForm = async (htmlFile, stored = {}) => {
  const dom = new JSDOM(readProjectFile(htmlFile), { runScripts: "outside-only" });
  const chrome = createChromeStub(stored);
  dom.window.chrome = chrome;
  const scripts = [...dom.window.document.querySelectorAll("script[src]")];
  dom.window.eval(scripts.map((script) => readProjectFile(script.getAttribute("src"))).join("\n"));
  await settle();
  return { window: dom.window, document: dom.window.document, saved: chrome.saved };
};

const isHidden = (element) => element.style.display === "none";

const LISTING_SELECTOR = 'li[class*="hz-Listing--"]';

const listings = (document) => [...document.querySelectorAll(LISTING_SELECTOR)];

const visibleTitles = (document) =>
  listings(document)
    .filter((listing) => !isHidden(listing))
    .map((listing) => listing.querySelector('[class*="ListingTitle_"]').textContent);

// A listing in Marktplaats' current markup, reduced to what the filters read.
const listing = ({ title, description = "", attributes = "", price = "€&nbsp;10,00" }) =>
  `<li class="hz-Listing hz-Listing--list-item">` +
  `<div class="hz-title-description ListingTitleDescription_hz-Listing-title-description__FIeUa">` +
  `<span class="hz-Text ListingTitle_hz-Listing-title-new__nbyD0">${title}</span>` +
  `<span class="hz-Text ListingDescription_hz-Listing-description-new__ByE0c">${description}</span></div>` +
  `<span class="ListingAttribute_hz-Attribute__RHK5D">${attributes}</span>` +
  `<div class="hz-price-date-feature ListingPriceDateFeature_hz-Listing-price-date-feature__OWdxh">` +
  `<h5 class="hz-Title ListingPrice_hz-Listing-price__p3UvB">${price}</h5><span>Vandaag</span></div></li>`;

const page = (listingsHtml, { nextHref = null, extra = "" } = {}) =>
  `<!doctype html><html><body>` +
  `<ul class="hz-Listings hz-Listings--list-view listings-container">${listingsHtml}</ul>` +
  extra +
  (nextHref ? `<nav><a aria-label="Volgende" href="${nextHref}">&gt;</a></nav>` : "") +
  `</body></html>`;

module.exports = {
  ALL_OFF,
  isHidden,
  listing,
  listings,
  loadForm,
  loadPage,
  page,
  readProjectFile,
  visibleTitles,
};
