// A text filter stays on for every later search. This notice above the
// results shows that it is active and offers a way to switch it off.
const NOTICE_CLASS = "mvm-text-filter-notice";
const NOTICE_MESSAGE_ATTRIBUTE = "data-mvm-message";
const NOTICE_STYLE =
  "display:flex;gap:12px;align-items:center;justify-content:space-between;" +
  "margin:0 0 12px;padding:8px 12px;border:1px solid #c9c9c9;border-radius:4px;" +
  "background:#fff8e1;color:#2d3c4d;font-size:14px;";
const SCOPE_LABELS = Object.freeze({
  title: "de titel",
  description: "de beschrijving",
  either: "de titel of beschrijving",
});

const noticeMessage = (textFilter) =>
  `Tekstfilter actief: alleen advertenties met "${textFilter.text}" in ` +
  `${SCOPE_LABELS[textFilter.scope]} worden getoond.`;

const createNotice = (message, onClear) => {
  const notice = document.createElement("div");
  notice.className = NOTICE_CLASS;
  notice.setAttribute(NOTICE_MESSAGE_ATTRIBUTE, message);
  notice.style.cssText = NOTICE_STYLE;

  const label = document.createElement("span");
  label.textContent = message;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Filter wissen";
  button.addEventListener("click", onClear);

  notice.append(label, button);
  return notice;
};

// Only touches the page when something actually has to change, so it does not
// keep waking up the MutationObserver that calls it.
const syncTextFilterNotice = (textFilter, list, onClear) => {
  const existing = document.querySelector(`.${NOTICE_CLASS}`);
  if (textFilter === null || !list) {
    if (existing) {
      existing.remove();
    }
    return;
  }
  const message = noticeMessage(textFilter);
  if (existing && existing.getAttribute(NOTICE_MESSAGE_ATTRIBUTE) === message) {
    return;
  }
  if (existing) {
    existing.remove();
  }
  list.parentNode.insertBefore(createNotice(message, onClear), list);
};
