// Shared by the content script, the popup, the options page and the service
// worker, so every part of the extension agrees on names and defaults.
const TEXT_SCOPES = Object.freeze(["title", "description", "either"]);
const MAX_REQUIRED_TEXT_LENGTH = 100;

const DEFAULT_SETTINGS = Object.freeze({
  hideCompanyAds: true,
  hideOpvalAds: true,
  hideDagtopperAds: true,
  hideHeelNederlandAds: true,
  hideSeeDescriptionAds: true,
  loadMorePages: true,
  requiredText: "",
  requiredTextScope: "title",
  requiredTextWholeWords: true,
});

const BOOLEAN_SETTING_KEYS = Object.freeze(
  Object.keys(DEFAULT_SETTINGS).filter(
    (key) => typeof DEFAULT_SETTINGS[key] === "boolean"
  )
);

// Stored data is external input: fill in what is missing and replace anything
// of the wrong shape, so the rest of the code can rely on the types.
const normalizeSettings = (stored) => {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(stored && typeof stored === "object" ? stored : {}),
  };
  const booleans = Object.fromEntries(
    BOOLEAN_SETTING_KEYS.map((key) => [key, Boolean(merged[key])])
  );
  return Object.freeze({
    ...booleans,
    requiredText:
      typeof merged.requiredText === "string"
        ? merged.requiredText.slice(0, MAX_REQUIRED_TEXT_LENGTH)
        : DEFAULT_SETTINGS.requiredText,
    requiredTextScope: TEXT_SCOPES.includes(merged.requiredTextScope)
      ? merged.requiredTextScope
      : DEFAULT_SETTINGS.requiredTextScope,
  });
};
