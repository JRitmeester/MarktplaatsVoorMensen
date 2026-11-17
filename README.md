# Marktplaats Voor Mensen

A Chrome extension that enhances your Marktplaats browsing experience by filtering out unwanted advertisements.

## Features

- Option to hide advertisements that contain links (indicating a business)
- Option to hide listings with a sticker above the ad
- Option to hide listings containing green text like "Dagtopper", "Topadvertentie", et cetera.
- Option to hide listings with location "Heel Nederland" (usually a business)
- Option to hide listings priced "Zie omschrijving" instead of an amount (often a business)
- Hides the "Advertenties door Marktplaats Pro" block entirely
- Option to automatically load the next page(s) when a page ends up nearly empty after filtering
- Text filter: show only listings that contain a given text (for example "Switch 2") in the title, the description, or either of them
- Removes the empty banner slots that would otherwise leave white gaps between the remaining listings
- Settings persist across browser sessions
- Clean and simple user interface

## Usage

1. Click the extension icon.
2. Toggle the switches to enable/disable different filtering options.
3. Optionally type a text under "Tekstfilter" and choose where to look for it. Leave the field empty to switch the text filter off.
4. Changes apply to open Marktplaats pages right away.

Notes on the text filter:
- It stays active for later searches. A notice above the results shows the active text and has a button to clear it.
- Upper and lower case do not matter. With "Alleen hele woorden" on, "Switch 2" does not match "Switch 2019" or "Switch 256GB".
- Marktplaats cuts descriptions short on a results page, so text further down in a description cannot be matched.

## Development

The extension is built using vanilla JavaScript and consists of:
- `manifest.json`: Extension configuration
- `settings.js`: Setting names, defaults and validation, shared by all parts
- `content.js`: Main filtering logic
- `text-filter.js`: Matching of the required text against title and description
- `notice.js`: The "text filter active" notice above the results
- `popup.html`, `options.html`: User interface for settings
- `settings-form.js`: Loads and saves the settings for both pages
- `background.js`: Fills in defaults for settings that are not stored yet
- `styles.css`: Styling for popup and options pages
- `test-element*.html`: Sample Marktplaats markup used by the tests
- `tests/`: Automated tests, run in jsdom

Run the tests with:

```bash
npm install
npm test
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

[GNU GPLv3](LICENSE)
