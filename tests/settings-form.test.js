const test = require("node:test");
const assert = require("node:assert/strict");
const { ALL_OFF, loadForm } = require("./helpers");

for (const htmlFile of ["popup.html", "options.html"]) {
  test(`${htmlFile} has a control for every setting and shows stored values`, async () => {
    const { document } = await loadForm(htmlFile, { requiredText: "Switch 2", requiredTextScope: "either", hideOpvalAds: false });
    Object.keys(ALL_OFF).forEach((id) => assert.ok(document.getElementById(id), id));
    assert.equal(document.getElementById("requiredText").value, "Switch 2");
    assert.equal(document.getElementById("requiredTextScope").value, "either");
    assert.equal(document.getElementById("hideOpvalAds").checked, false);
    assert.equal(document.getElementById("hideCompanyAds").checked, true);
    assert.equal(document.getElementById("requiredTextWholeWords").checked, true);
  });

  test(`${htmlFile} saves text, scope and checkboxes as they change`, async () => {
    const { window, document, saved } = await loadForm(htmlFile);
    const fire = (id, type, change) => {
      const control = document.getElementById(id);
      change(control);
      control.dispatchEvent(new window.Event(type, { bubbles: true }));
    };
    fire("requiredText", "input", (control) => { control.value = "Switch 2"; });
    fire("requiredTextScope", "change", (control) => { control.value = "description"; });
    fire("hideCompanyAds", "change", (control) => { control.checked = false; });
    // Saved objects come from the jsdom realm, so compare plain copies.
    assert.deepEqual(JSON.parse(JSON.stringify(saved)), [
      { requiredText: "Switch 2" },
      { requiredTextScope: "description" },
      { hideCompanyAds: false },
    ]);
  });
}
