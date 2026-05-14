import { test, expect } from '@playwright/test';

test.describe('Real-time drawing sync', () => {
  test('stroke drawn in tab 1 appears in tab 2 within 1s', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');

    // Create a room
    await page1.getByRole('button', { name: /create room/i }).click();
    await page1.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });
    const roomId = await page1.locator('[data-testid="room-id"]').textContent();

    // Join from tab 2
    await page2.goto('/');
    await page2.getByPlaceholder(/room id/i).fill(roomId);
    await page2.getByRole('button', { name: /join room/i }).click();
    await page2.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });

    // Draw a stroke in tab 1
    const canvas1 = page1.locator('canvas');
    await canvas1.hover({ position: { x: 100, y: 100 } });
    await page1.mouse.down();
    await page1.mouse.move(200, 200, { steps: 5 });
    await page1.mouse.up();

    // Wait up to 1s for the stroke to appear on tab 2 canvas
    await page2.waitForTimeout(1000);
    const canvas2 = page2.locator('canvas');
    const pixel = await canvas2.evaluate((el) => {
      const ctx = el.getContext('2d');
      const d = ctx.getImageData(150, 150, 1, 1).data;
      return d[3]; // alpha channel — non-zero means something was drawn
    });
    expect(pixel).toBeGreaterThan(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('stroke drawn in tab 2 appears in tab 1', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page1.getByRole('button', { name: /create room/i }).click();
    await page1.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });
    const roomId = await page1.locator('[data-testid="room-id"]').textContent();

    await page2.goto('/');
    await page2.getByPlaceholder(/room id/i).fill(roomId);
    await page2.getByRole('button', { name: /join room/i }).click();
    await page2.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });

    // Draw from tab 2
    const canvas2 = page2.locator('canvas');
    await canvas2.hover({ position: { x: 300, y: 300 } });
    await page2.mouse.down();
    await page2.mouse.move(400, 400, { steps: 5 });
    await page2.mouse.up();

    await page1.waitForTimeout(1000);
    const pixel = await page1.locator('canvas').evaluate((el) => {
      const ctx = el.getContext('2d');
      const d = ctx.getImageData(350, 350, 1, 1).data;
      return d[3];
    });
    expect(pixel).toBeGreaterThan(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('new joiner sees all previously drawn strokes', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page3 = await ctx3.newPage();

    await page1.goto('/');
    await page1.getByRole('button', { name: /create room/i }).click();
    await page1.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });
    const roomId = await page1.locator('[data-testid="room-id"]').textContent();

    // Draw something on tab 1
    const canvas1 = page1.locator('canvas');
    await canvas1.hover({ position: { x: 100, y: 100 } });
    await page1.mouse.down();
    await page1.mouse.move(200, 200, { steps: 5 });
    await page1.mouse.up();
    await page1.waitForTimeout(200);

    // Late joiner
    await page3.goto('/');
    await page3.getByPlaceholder(/room id/i).fill(roomId);
    await page3.getByRole('button', { name: /join room/i }).click();
    await page3.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });
    await page3.waitForTimeout(500);

    const pixel = await page3.locator('canvas').evaluate((el) => {
      const ctx = el.getContext('2d');
      const d = ctx.getImageData(150, 150, 1, 1).data;
      return d[3];
    });
    expect(pixel).toBeGreaterThan(0);

    await ctx1.close();
    await ctx3.close();
  });
});
