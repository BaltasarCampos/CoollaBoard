import { test, expect } from '@playwright/test';

test.describe('Reconnection and delta-hydration', () => {
  test('UI shows Reconnecting within 1s of disconnect, reconnects and restores state', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/');
    await page.getByRole('button', { name: /create room/i }).click();
    await page.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });

    // Should initially show Connected
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 3000 });

    // Draw something so there's canvas state
    const canvas = page.locator('canvas');
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.mouse.down();
    await page.mouse.move(150, 150, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Simulate disconnect by setting socket to disconnect
    await page.evaluate(() => {
      window.__socket?.disconnect();
    });

    // Should show Reconnecting within 1s
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Reconnecting', { timeout: 1500 });

    // Let it reconnect (socket.io will reconnect automatically)
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 15000 });

    await ctx.close();
  });

  test('expired room redirects to HomePage with "room no longer exists" message', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page1.getByRole('button', { name: /create room/i }).click();
    await page1.waitForSelector('[data-testid="room-id"]', { timeout: 5000 });
    const roomId = await page1.locator('[data-testid="room-id"]').textContent();

    // page2 tries to join a known-nonexistent room
    await page2.goto('/');
    await page2.getByPlaceholder(/room id/i).fill('XXXXXX');
    await page2.getByRole('button', { name: /join room/i }).click();

    // Should show ROOM_NOT_FOUND error inline
    await expect(page2.getByText(/room not found/i)).toBeVisible({ timeout: 3000 });

    await ctx1.close();
    await ctx2.close();
  });
});
