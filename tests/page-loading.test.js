const test = require("node:test");
const assert = require("node:assert/strict");
const { listing, loadPage, page, pageBody, pageCountLabels, visibleTitles } = require("./helpers");

const FILTERS = "#q:switch+2|PriceCentsFrom:25000|PriceCentsTo:36000";
const STORED = { hideCompanyAds: true, loadMorePages: true };
// The server ignores the filters; only the frame shows the filtered page.
const SERVER_PAGES = {
  "/q/test/p/2/": page(listing({ title: "Ongefilterd pagina 2", price: "€&nbsp;395,00" }), { nextHref: "/q/test/p/3/" }),
  "/q/test/p/3/": page(listing({ title: "Ongefilterd pagina 3", price: "€&nbsp;5,00" })),
};
const FILTERED_FRAMES = {
  [`/q/test/p/2/${FILTERS}`]: pageBody(listing({ title: "Gefilterd pagina 2", price: "€&nbsp;300,00" }), { nextHref: "/q/test/p/3/" }),
  [`/q/test/p/3/${FILTERS}`]: pageBody(listing({ title: "Gefilterd pagina 3", price: "€&nbsp;310,00" })),
};
const firstPage = page(listing({ title: "Pagina 1" }), { nextHref: "/q/test/p/2/", pageCount: "Pagina 1 van 10" });

test("with search filters, later pages come from a frame that carries the filters", async () => {
  const { document, fetched } = await loadPage({
    html: firstPage,
    path: `/q/test/${FILTERS}`,
    pages: SERVER_PAGES,
    frames: FILTERED_FRAMES,
    stored: STORED,
    settleMs: 6000,
  });
  assert.deepEqual(visibleTitles(document), ["Pagina 1", "Gefilterd pagina 2", "Gefilterd pagina 3"]);
  assert.deepEqual(fetched, []);
  assert.equal(document.querySelector("iframe"), null);
  assert.deepEqual(
    [...document.querySelectorAll(".mvm-page-divider")].map((divider) => divider.textContent),
    ["Pagina 2", "Pagina 3"]
  );
});

test("pages loaded for one search are removed when the filters change", async () => {
  const { window, document } = await loadPage({
    html: firstPage,
    path: `/q/test/${FILTERS}`,
    pages: SERVER_PAGES,
    frames: FILTERED_FRAMES,
    stored: STORED,
    settleMs: 6000,
  });
  assert.equal(visibleTitles(document).length, 3);
  window.location.hash = "#q:iets+anders";
  document.body.appendChild(document.createElement("span"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(visibleTitles(document), ["Pagina 1"]);
  assert.equal(document.querySelector(".mvm-page-divider"), null);
  assert.deepEqual(pageCountLabels(document), ["Pagina 1 van 10"]);
});

test("without search filters the next pages are still fetched directly", async () => {
  const { document, fetched } = await loadPage({
    html: firstPage,
    pages: SERVER_PAGES,
    stored: STORED,
    settleMs: 300,
  });
  assert.deepEqual(fetched, ["/q/test/p/2/", "/q/test/p/3/"]);
  assert.deepEqual(visibleTitles(document), ["Pagina 1", "Ongefilterd pagina 2", "Ongefilterd pagina 3"]);
});

test("the page count shows the range of pages that are on screen", async () => {
  const { document } = await loadPage({ html: firstPage, pages: SERVER_PAGES, stored: STORED, settleMs: 300 });
  assert.deepEqual(pageCountLabels(document), ["Pagina 1 t/m 3 van 10"]);
  const untouched = await loadPage({ html: firstPage, pages: SERVER_PAGES, stored: { hideCompanyAds: true } });
  assert.deepEqual(pageCountLabels(untouched.document), ["Pagina 1 van 10"]);
});

const PHOTO = "02632ecc-fe6c-4f29-b00b-51a65d9b5c9b";
const VIP_URL = "/v/spelcomputers-en-games/spelcomputers-nintendo-switch/m123-nintendo-switch-2";
const SEARCH_RESULTS = {
  listings: [
    { title: "Zonder link", vipUrl: VIP_URL, imageUrls: [`//images.marktplaats.com/api/v1/hz-mp-pro-listing/images/${PHOTO}?rule=y`] },
    { title: "Kwaadaardig", vipUrl: "//evil.example/v/m999" },
  ],
};
const unlinked = listing({ title: "Zonder link", image: PHOTO }) + listing({ title: "Kwaadaardig", image: "ffffffff-0000-0000-0000-000000000000" });
const coverHrefs = (document) =>
  [...document.querySelectorAll('[data-mvm-loaded] a[class*="coverLink"]')].map((anchor) => anchor.getAttribute("href"));

test("a fetched listing without a link gets its address from the embedded results", async () => {
  const nextData = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { searchRequestAndResponse: SEARCH_RESULTS } },
  })}</script>`;
  const { document } = await loadPage({
    html: firstPage,
    pages: { "/q/test/p/2/": page(unlinked, { extra: nextData }) },
    stored: STORED,
    settleMs: 300,
  });
  assert.deepEqual(coverHrefs(document), [VIP_URL, null]);
});

test("a framed listing without a link gets its address from the search request", async () => {
  const apiUrl = "/lrp/api/search?offset=30&query=switch%202";
  const { document, fetched } = await loadPage({
    html: firstPage,
    path: `/q/test/${FILTERS}`,
    pages: { ...SERVER_PAGES, "/lrp/api/search": JSON.stringify(SEARCH_RESULTS) },
    frames: { [`/q/test/p/2/${FILTERS}`]: { body: pageBody(unlinked), apiUrl } },
    stored: STORED,
    settleMs: 5000,
  });
  assert.deepEqual(fetched, ["/lrp/api/search"]);
  assert.deepEqual(coverHrefs(document), [VIP_URL, null]);
});
