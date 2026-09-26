// Renders the home-screen icons (the Spark Hub bolt on brand purple) to PNG.
// Uses the tests' Playwright:  node scripts/make-icons.js
const path = require('path');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(__dirname, '..', 'tests')] }));
const OUT = path.join(__dirname, '..', 'icons');
const BOLT = '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#f3c55a" stroke="#f3c55a" stroke-width="1.7" stroke-linejoin="round"/>' +
  '<path d="M4.6 4.6 6.9 7.2M1.9 15.2 5.1 14.9M19.4 4.6 17.1 7.2M22.1 15.2 18.9 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/>';
// scale: how much of the square the bolt fills ("maskable" keeps it inside the 80% safe circle)
const ICONS = [['icon-180.png', 180, .66], ['icon-192.png', 192, .66], ['icon-512.png', 512, .66], ['icon-maskable-512.png', 512, .5]];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, size, scale] of ICONS) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent('<body style="margin:0"><div style="width:' + size + 'px;height:' + size + 'px;background:#5b4ae8;display:flex;align-items:center;justify-content:center">' +
      '<svg width="' + Math.round(size * scale) + '" height="' + Math.round(size * scale) + '" viewBox="0 0 24 24" fill="none">' + BOLT + '</svg></div></body>');
    await p.screenshot({ path: path.join(OUT, name) });
    console.log('wrote', name);
  }
  await b.close();
})();
