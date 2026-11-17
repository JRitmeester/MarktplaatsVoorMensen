// Marktplaats' "Pagina 1 van 10" below the results no longer fits once later
// pages have been added to this one. It is replaced by the range that is
// actually on screen, for example "Pagina 1 t/m 6 van 10".
//
// Marktplaats' own label is hidden rather than rewritten, so its script can
// keep updating it; ours sits next to it.
const PAGE_COUNT_SELECTOR = '[class*="amountOfPages"]';
const OWN_PAGE_COUNT_ATTRIBUTE = "data-mvm-page-count";
const REPLACED_PAGE_COUNT_ATTRIBUTE = "data-mvm-page-count-replaced";
const PAGE_TOTAL_PATTERN = /Pagina\s+\d+\s+van\s+(\d+)/;

const loadedPageCount = () =>
  document.querySelectorAll(`.${PAGE_DIVIDER_CLASS}`).length;

const pageRangeText = (original) => {
  const loaded = loadedPageCount();
  const match = original.textContent.match(PAGE_TOTAL_PATTERN);
  if (loaded === 0 || match === null) {
    return null;
  }
  const first = pageNumberFromPath(location.pathname);
  return `Pagina ${first} t/m ${first + loaded} van ${match[1]}`;
};

const restorePageCount = (original, own) => {
  if (own) {
    own.remove();
  }
  if (original && original.hasAttribute(REPLACED_PAGE_COUNT_ATTRIBUTE)) {
    original.removeAttribute(REPLACED_PAGE_COUNT_ATTRIBUTE);
    original.style.display = "";
  }
};

const createOwnPageCount = (original, text) => {
  const own = original.cloneNode(false);
  own.setAttribute(OWN_PAGE_COUNT_ATTRIBUTE, "true");
  own.style.display = "";
  own.textContent = text;
  return own;
};

// Only touches the page when something has to change, so it does not keep
// waking up the MutationObserver that calls it.
const syncPageCount = () => {
  const original = document.querySelector(
    `${PAGE_COUNT_SELECTOR}:not([${OWN_PAGE_COUNT_ATTRIBUTE}])`
  );
  const own = document.querySelector(`[${OWN_PAGE_COUNT_ATTRIBUTE}]`);
  const text = original ? pageRangeText(original) : null;
  if (text === null) {
    restorePageCount(original, own);
    return;
  }
  if (own && own.textContent === text && original.nextSibling === own) {
    return;
  }
  if (own) {
    own.remove();
  }
  original.setAttribute(REPLACED_PAGE_COUNT_ATTRIBUTE, "true");
  original.style.display = "none";
  original.after(createOwnPageCount(original, text));
};
