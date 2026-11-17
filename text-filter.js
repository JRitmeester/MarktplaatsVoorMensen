// Text filter: keep only listings that contain a given text in the title, the
// description, or either of them.
//
// Marktplaats renders each listing several times (desktop, tablet, mobile), so
// a listing matches as soon as one of those copies matches. Descriptions on a
// results page are cut off by Marktplaats; text further down is not visible
// here and therefore cannot match.
const TITLE_SELECTOR =
  '[class*="ListingTitle_"], [class*="hz-Listing-title-new"], .hz-Listing-title';
const DESCRIPTION_SELECTOR =
  '[class*="ListingDescription_"], [class*="hz-Listing-description-new"], .hz-Listing-description';
const READABLE_TEXT_SELECTOR = `${TITLE_SELECTOR}, ${DESCRIPTION_SELECTOR}`;

const SCOPE_SELECTORS = Object.freeze({
  title: TITLE_SELECTOR,
  description: DESCRIPTION_SELECTOR,
  either: READABLE_TEXT_SELECTOR,
});

const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const NOT_AFTER_WORD = "(?<![\\p{L}\\p{N}])";
const NOT_BEFORE_WORD = "(?![\\p{L}\\p{N}])";

// Case and the amount of whitespace never matter for a match.
const normalizeText = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// With whole words, "switch 2" does not match "switch 2019" or "switch 256gb".
const createWholeWordPattern = (needle) => {
  const characters = [...needle];
  const before = WORD_CHARACTER.test(characters[0]) ? NOT_AFTER_WORD : "";
  const after = WORD_CHARACTER.test(characters[characters.length - 1])
    ? NOT_BEFORE_WORD
    : "";
  return new RegExp(`${before}${escapeRegExp(needle)}${after}`, "u");
};

const createTextMatcher = (requiredText, wholeWords) => {
  const needle = normalizeText(requiredText);
  if (needle === "") {
    return null;
  }
  if (!wholeWords) {
    return (text) => normalizeText(text).includes(needle);
  }
  const pattern = createWholeWordPattern(needle);
  return (text) => pattern.test(normalizeText(text));
};

// Returns null when no text is set, so callers can tell "off" from "on".
const createTextFilter = (settings) => {
  const matches = createTextMatcher(
    settings.requiredText,
    settings.requiredTextWholeWords
  );
  if (matches === null) {
    return null;
  }
  const selector = SCOPE_SELECTORS[settings.requiredTextScope];
  return Object.freeze({
    text: settings.requiredText.trim(),
    scope: settings.requiredTextScope,
    // A listing without any recognisable title or description means the
    // markup changed. Keep it visible instead of emptying the whole page.
    lacksRequiredText: (listing) =>
      listing.querySelector(READABLE_TEXT_SELECTOR) !== null &&
      ![...listing.querySelectorAll(selector)].some((element) =>
        matches(element.textContent)
      ),
  });
};
