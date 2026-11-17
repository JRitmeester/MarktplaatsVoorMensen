const test = require("node:test");
const assert = require("node:assert/strict");
const { listing, listings, loadPage, page, readProjectFile, visibleTitles, isHidden } = require("./helpers");

const SWITCH_2_TITLE = listing({ title: "Nintendo Switch 2 met doos", description: "In prima staat" });
const SWITCH_2_DESCRIPTION = listing({ title: "Nintendo Switch OLED", description: "Geen switch 2 helaas, wel oled" });
const SWITCH_ORIGINAL = listing({ title: "Nintendo Switch", description: "Met 2 controllers", attributes: "Switch 2" });
const SWITCH_256 = listing({ title: "Nintendo Switch 256GB kaart", description: "Geheugenkaart" });
const MESSY_TITLE = listing({ title: "NINTENDO   SWITCH&nbsp;2", description: "" });
const ALL = [SWITCH_2_TITLE, SWITCH_2_DESCRIPTION, SWITCH_ORIGINAL, SWITCH_256, MESSY_TITLE].join("");

const titlesFor = async (stored, html = page(ALL)) =>
  visibleTitles((await loadPage({ html, stored })).document).map((title) => title.replace(/\s+/g, " "));

test("title scope keeps only listings with the text in the title", async () => {
  assert.deepEqual(await titlesFor({ requiredText: "Switch 2", requiredTextScope: "title" }), [
    "Nintendo Switch 2 met doos",
    "NINTENDO SWITCH 2",
  ]);
});

test("description scope keeps only listings with the text in the description", async () => {
  assert.deepEqual(await titlesFor({ requiredText: "Switch 2", requiredTextScope: "description" }), [
    "Nintendo Switch OLED",
  ]);
});

test("either scope keeps listings with the text in title or description", async () => {
  assert.deepEqual(await titlesFor({ requiredText: "Switch 2", requiredTextScope: "either" }), [
    "Nintendo Switch 2 met doos",
    "Nintendo Switch OLED",
    "NINTENDO SWITCH 2",
  ]);
});

test("matching ignores case and surrounding whitespace in the search text", async () => {
  assert.deepEqual(await titlesFor({ requiredText: "  switch   2 ", requiredTextScope: "title" }), [
    "Nintendo Switch 2 met doos",
    "NINTENDO SWITCH 2",
  ]);
});

test("without whole words a longer number still matches", async () => {
  const titles = await titlesFor({ requiredText: "Switch 2", requiredTextScope: "title", requiredTextWholeWords: false });
  assert.ok(titles.includes("Nintendo Switch 256GB kaart"));
});

test("empty search text hides nothing", async () => {
  assert.equal((await titlesFor({ requiredText: "   " })).length, 5);
});

test("unknown scope falls back to the title", async () => {
  assert.deepEqual(await titlesFor({ requiredText: "Switch 2", requiredTextScope: "bogus" }), [
    "Nintendo Switch 2 met doos",
    "NINTENDO SWITCH 2",
  ]);
});

test("search text with regex characters is matched literally", async () => {
  const html = page(listing({ title: "Boek C++ (2e druk) nieuw" }) + listing({ title: "Boek C (2e druk)" }));
  assert.deepEqual(await titlesFor({ requiredText: "C++ (2e druk)" }, html), ["Boek C++ (2e druk) nieuw"]);
});

test("the real Switch 2 sample matches in every scope", async () => {
  const html = page(readProjectFile("test-element7.html"));
  for (const scope of ["title", "description", "either"]) {
    const { document } = await loadPage({ html, stored: { requiredText: "Switch 2", requiredTextScope: scope } });
    assert.equal(isHidden(listings(document)[0]), false, scope);
  }
  const { document } = await loadPage({ html, stored: { requiredText: "Switch OLED", requiredTextScope: "either" } });
  assert.equal(isHidden(listings(document)[0]), true);
});

test("a notice shows the active text filter and is absent without one", async () => {
  const active = await loadPage({ html: page(ALL), stored: { requiredText: "Switch 2", requiredTextScope: "title" } });
  const notice = active.document.querySelector(".mvm-text-filter-notice");
  assert.ok(notice);
  assert.match(notice.textContent, /"Switch 2" in de titel/);
  const inactive = await loadPage({ html: page(ALL), stored: { hideCompanyAds: true } });
  assert.equal(inactive.document.querySelector(".mvm-text-filter-notice"), null);
});

test("a sparse page loads the next page and filters it by text too", async () => {
  const { document, fetched } = await loadPage({
    html: page(SWITCH_ORIGINAL, { nextHref: "/q/test/p/2/" }),
    path: "/q/test/",
    pages: { "/q/test/p/2/": page(SWITCH_2_TITLE + SWITCH_256) },
    stored: { requiredText: "Switch 2", loadMorePages: true },
  });
  assert.deepEqual(fetched, ["/q/test/p/2/"]);
  assert.deepEqual(visibleTitles(document), ["Nintendo Switch 2 met doos"]);
});
