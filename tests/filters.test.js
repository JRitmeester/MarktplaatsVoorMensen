const test = require("node:test");
const assert = require("node:assert/strict");
const { isHidden, listing, listings, loadPage, page, readProjectFile } = require("./helpers");

const sample = (number) => readProjectFile(`test-element${number}.html`);
const firstListingHidden = async (html, stored) =>
  isHidden(listings((await loadPage({ html: page(html), stored })).document)[0]);

test("a company listing with a top label is hidden by either filter", async () => {
  assert.equal(await firstListingHidden(sample(3), { hideCompanyAds: true }), true);
  assert.equal(await firstListingHidden(sample(3), { hideDagtopperAds: true }), true);
  assert.equal(await firstListingHidden(sample(3), {}), false);
});

test("an Opvalsticker listing is hidden by its filter", async () => {
  assert.equal(await firstListingHidden(sample(5), { hideOpvalAds: true }), true);
});

test("a Heel Nederland listing is hidden by its own filter only", async () => {
  assert.equal(await firstListingHidden(sample(6), { hideHeelNederlandAds: true }), true);
  assert.equal(await firstListingHidden(sample(6), { hideCompanyAds: true }), false);
});

test("a private listing survives every ad filter", async () => {
  const stored = { hideCompanyAds: true, hideOpvalAds: true, hideDagtopperAds: true, hideHeelNederlandAds: true };
  assert.equal(await firstListingHidden(sample(7), stored), false);
});

test("the Marktplaats Pro block is hidden as a whole", async () => {
  const html = page(sample(7), { extra: sample(4) });
  const { document } = await loadPage({ html, stored: { hideCompanyAds: true } });
  assert.equal(isHidden(document.querySelector('[data-testid="BottomBlockLazyListings"]')), true);
});

test("banner slots and their loading placeholder are hidden while filtering", async () => {
  const slots = '<li class="bannerContainerLoading"></li><div class="hz-Banner hz-Banner--fluid"></div>';
  const html = page(slots + sample(7));
  const filtering = await loadPage({ html, stored: { hideCompanyAds: true } });
  assert.equal(isHidden(filtering.document.querySelector(".bannerContainerLoading")), true);
  assert.equal(isHidden(filtering.document.querySelector(".hz-Banner")), true);
  const idle = await loadPage({ html });
  assert.equal(isHidden(idle.document.querySelector(".bannerContainerLoading")), false);
});

test("changed settings apply without a reload, in both directions", async () => {
  const html = page(sample(3) + listing({ title: "Nintendo Switch OLED" }));
  const { document, changeSettings } = await loadPage({ html, stored: { hideDagtopperAds: true } });
  const hidden = () => listings(document).map(isHidden);
  assert.deepEqual(hidden(), [true, false]);
  await changeSettings({ hideDagtopperAds: false, requiredText: "roomdivider" });
  assert.deepEqual(hidden(), [false, true]);
});

test("the notice button clears the text filter", async () => {
  const html = page(listing({ title: "Nintendo Switch OLED" }));
  const { document } = await loadPage({ html, stored: { requiredText: "Switch 2" } });
  assert.equal(isHidden(listings(document)[0]), true);
  document.querySelector(".mvm-text-filter-notice button").click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(isHidden(listings(document)[0]), false);
  assert.equal(document.querySelector(".mvm-text-filter-notice"), null);
});

test("a listing without recognisable text is kept when the text filter is on", async () => {
  const html = page('<li class="hz-Listing hz-Listing--list-item"><span>Iets anders</span></li>');
  assert.equal(await firstListingHidden(html, { requiredText: "Switch 2" }), false);
});

test("old markup is matched by the text filter too", async () => {
  assert.equal(await firstListingHidden(sample(2), { requiredText: "zeker niet aanwezig" }), true);
});

test("a listing priced \"Zie omschrijving\" is hidden by its own filter only", async () => {
  const html = page(
    listing({ title: "Met vaste prijs" }) +
      listing({ title: "Zonder prijs", price: " Zie omschrijving " }) +
      listing({ title: "Alleen in de tekst", description: "Zie omschrijving voor details" })
  );
  const hiddenWith = async (stored) => listings((await loadPage({ html, stored })).document).map(isHidden);
  assert.deepEqual(await hiddenWith({ hideSeeDescriptionAds: true }), [false, true, false]);
  assert.deepEqual(await hiddenWith({ hideCompanyAds: true }), [false, false, false]);
});

test("the real \"Zie omschrijving\" sample is hidden by that filter", async () => {
  assert.equal(await firstListingHidden(sample(7), { hideSeeDescriptionAds: true }), true);
});
