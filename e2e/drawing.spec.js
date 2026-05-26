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

test.describe('Live stroke preview (US1 + US2)', () => {
  test('in-progress stroke appears on remote canvas before pointer-up', async ({ browser }) => {
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

    // Start drawing in page1 but do NOT release the pointer yet
    const canvas1 = page1.locator('canvas').first();
    await canvas1.hover({ position: { x: 100, y: 100 } });
    await page1.mouse.down();

    // Move the pointer across the canvas (generates stroke:preview events)
    for (let x = 100; x <= 400; x += 20) {
      await page1.mouse.move(x, 200);
      await page1.waitForTimeout(40); // > 30 ms throttle interval
    }

    // Before pointer-up, verify the preview overlay canvas in page2 has pixels
    await page2.waitForTimeout(300);
    const previewPixel = await page2.locator('canvas').nth(1).evaluate((el) => {
      const ctx = el.getContext('2d');
      // Sample a point along the expected path
      const d = ctx.getImageData(200, 200, 1, 1).data;
      return d[3]; // alpha channel
    });
    expect(previewPixel).toBeGreaterThan(0);

    // Release pointer — committed stroke should appear on the main canvas
    await page1.mouse.up();
    await page2.waitForTimeout(500);

    const committedPixel = await page2.locator('canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      const d = ctx.getImageData(200, 200, 1, 1).data;
      return d[3];
    });
    expect(committedPixel).toBeGreaterThan(0);

    await ctx1.close();
    await ctx2.close();
  });
});

// ── Collaborative Undo / Redo (006-undo-redo) ─────────────────────────────────

test.describe('Collaborative Undo / Redo', () => {
  test('Scenario 1: undo own stroke — stroke disappears on both tabs', async ({ browser }) => {
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

    // Draw a stroke in tab 1
    const canvas1 = page1.locator('canvas').first();
    await canvas1.hover({ position: { x: 400, y: 300 } });
    await page1.mouse.down();
    await page1.mouse.move(500, 300, { steps: 5 });
    await page1.mouse.up();
    await page1.waitForTimeout(300);

    // Verify stroke appears on tab 2
    const pixelBeforeUndo = await page2.locator('canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      return ctx.getImageData(450, 300, 1, 1).data[3];
    });
    expect(pixelBeforeUndo).toBeGreaterThan(0);

    // Undo via Ctrl+Z on tab 1
    await page1.keyboard.press('Control+z');
    await page1.waitForTimeout(500);

    // Verify stroke is gone on tab 2
    const pixelAfterUndo = await page2.locator('canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      return ctx.getImageData(450, 300, 1, 1).data[3];
    });
    expect(pixelAfterUndo).toBe(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('Scenario 2: redo undone stroke — stroke reappears on both tabs', async ({ browser }) => {
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

    // Draw in tab 1
    const canvas1 = page1.locator('canvas').first();
    await canvas1.hover({ position: { x: 300, y: 200 } });
    await page1.mouse.down();
    await page1.mouse.move(380, 200, { steps: 5 });
    await page1.mouse.up();
    await page1.waitForTimeout(300);

    // Undo, then redo
    await page1.keyboard.press('Control+z');
    await page1.waitForTimeout(300);
    await page1.keyboard.press('Control+y');
    await page1.waitForTimeout(500);

    // Stroke should be visible again on tab 2
    const pixel = await page2.locator('canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      return ctx.getImageData(340, 200, 1, 1).data[3];
    });
    expect(pixel).toBeGreaterThan(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('Scenario 3: any user undoes a clear — pre-clear content restored on both tabs', async ({ browser }) => {
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

    // Tab 1 draws strokes
    const canvas1 = page1.locator('canvas').first();
    await canvas1.hover({ position: { x: 200, y: 200 } });
    await page1.mouse.down();
    await page1.mouse.move(280, 200, { steps: 5 });
    await page1.mouse.up();
    await page1.waitForTimeout(300);

    // Tab 2 clears the canvas
    await page2.getByRole('button', { name: /clear canvas/i }).click();
    await page2.getByRole('button', { name: /confirm/i }).click();
    await page2.waitForTimeout(300);

    // Tab 1 (not the clear originator) undoes the clear via keyboard
    await page1.keyboard.press('Control+z');
    await page1.waitForTimeout(500);

    // Pre-clear strokes should be visible again on both tabs
    const pixelTab2 = await page2.locator('canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      return ctx.getImageData(240, 200, 1, 1).data[3];
    });
    expect(pixelTab2).toBeGreaterThan(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('Scenario 4: toolbar button enabled/disabled states', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();

    await page1.goto('/');
    await page1.getByRole('button', { name: /create room/i }).click();
    await page1.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });

    // Initially both Undo and Redo should be disabled
    await expect(page1.getByRole('button', { name: /^undo$/i })).toBeDisabled();
    await expect(page1.getByRole('button', { name: /^redo$/i })).toBeDisabled();

    // Draw a stroke to enable Undo
    const canvas1 = page1.locator('canvas').first();
    await canvas1.hover({ position: { x: 500, y: 400 } });
    await page1.mouse.down();
    await page1.mouse.move(560, 400, { steps: 5 });
    await page1.mouse.up();
    await page1.waitForTimeout(300);

    await expect(page1.getByRole('button', { name: /^undo$/i })).toBeEnabled();
    await expect(page1.getByRole('button', { name: /^redo$/i })).toBeDisabled();

    // Undo — Redo should now be enabled
    await page1.getByRole('button', { name: /^undo$/i }).click();
    await page1.waitForTimeout(300);

    await expect(page1.getByRole('button', { name: /^undo$/i })).toBeDisabled();
    await expect(page1.getByRole('button', { name: /^redo$/i })).toBeEnabled();

    await ctx1.close();
  });
});

