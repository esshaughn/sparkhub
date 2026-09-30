// Renders the default link-preview image (icons/share.jpg, 1200x630): the bolt and "Spark Hub"
// on brand purple. Idea and invite links use their own photo instead (api/preview.js).
// Uses the tests' Playwright:  node scripts/make-share-image.js
const path = require('path');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(__dirname, '..', 'tests')] }));
const BOLT = '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#f3c55a" stroke="#f3c55a" stroke-width="1.7" stroke-linejoin="round"/>' +
  '<path d="M4.6 4.6 6.9 7.2M1.9 15.2 5.1 14.9M19.4 4.6 17.1 7.2M22.1 15.2 18.9 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/>';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent('<head><link href="https://fonts.googleapis.com/css2?family=Figtree:wght@600;900&display=swap" rel="stylesheet"></head>' +
    '<body style="margin:0;font-family:Figtree,sans-serif"><div style="width:1200px;height:630px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;gap:44px">' +
    '<svg width="220" height="220" viewBox="0 0 24 24" fill="none">' + BOLT + '</svg>' +
    '<div style="color:#fff"><div style="font-size:112px;font-weight:900;letter-spacing:-3px;line-height:1">Spark Hub</div>' +
    '<div style="margin-top:18px;font-size:40px;font-weight:600;color:#dcd8fb">Make plans with your people.</div></div></div></body>');
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, '..', 'icons', 'share.jpg'), type: 'jpeg', quality: 85 });
  console.log('wrote icons/share.jpg');
  await b.close();
})();
