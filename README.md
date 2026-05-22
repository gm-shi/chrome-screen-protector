# Pet Screen Protector Chrome Extension

A local-only Manifest V3 Chrome extension that lets you upload one pet image, start a manual screen-time timer, and show an animated browser overlay when the timer expires.

## What it does

- Upload or replace one pet image from the popup.
- Set screen time in minutes.
- Set protector duration from 1 to 5 minutes.
- When the timer ends, open web pages receive a full-page animated pet protector.
- The protector can be dismissed manually and also closes automatically.

## Local development

```bash
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.

After code changes, run `npm run build` again and click reload on the extension card.

## Known limitations

- This covers normal web pages in Chrome, not the full desktop, Chrome settings pages, the extensions page, or the browser UI.
- The pet animation is local CSS-based motion around the uploaded image. It does not call an AI video API.
- Some restricted pages block extension script injection.
