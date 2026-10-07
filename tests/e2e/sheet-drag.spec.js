// Drag to close (owner, 2026-10-06): a slide-up follows a downward drag, springs back from a short one and closes
// from a long one or a quick flick.
const { test, expect } = require('@playwright/test');
const { newLead } = require('./helpers');

test('slide-ups close when dragged down', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Drag Lead');
  try {
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const drag = async (x, y0, y1, steps, wait) => {
      await touch('touchStart', x, y0);
      for (let i = 1; i <= steps; i++) { await touch('touchMove', x, y0 + (y1 - y0) * i / steps); if (wait) await page.waitForTimeout(wait); }
    };
    const open = async () => {
      await page.getByRole('button', { name: /^Notifications/ }).first().click();
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(400);   // the slide-in
    };
    const sheet = page.getByRole('dialog', { name: 'Notifications' });
    await open();
    const box = await sheet.boundingBox();

    // A short drag: the sheet follows the finger, then springs back when let go
    await drag(200, box.y + 20, box.y + 100, 5, 16);
    expect(await sheet.evaluate(e => parseFloat(getComputedStyle(e).translate.split(' ')[1]))).toBeGreaterThan(40);
    await touch('touchEnd');
    await page.waitForTimeout(400);
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate(e => e.style.translate)).toBe('');

    // Past a third of its height: it closes
    await drag(200, box.y + 20, box.y + 20 + box.height * 0.45, 10, 16);
    await page.waitForTimeout(150);   // held still: not a flick
    await touch('touchEnd');
    await expect(sheet).toHaveCount(0);

    // A quick flick closes it too
    await open();
    await drag(200, box.y + 20, box.y + 110, 3, 0);
    await touch('touchEnd');
    await expect(sheet).toHaveCount(0);
  } finally {
    await context.close();
  }
});
