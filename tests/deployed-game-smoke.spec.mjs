import { test, expect } from 'playwright/test';

test.describe('deployed game smoke test', () => {
  const fatalErrors = [];

  test.beforeEach(async ({ page }) => {
    fatalErrors.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter cross-origin noise from legacy RequireJS loading over CDN
        const isKnownNoise = /Cross-Origin .* blocked/i.test(text)
          || /Loading failed for the .* script/i.test(text);
        if (!isKnownNoise) {
          fatalErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      fatalErrors.push(error.message);
    });
  });

  test('loads the game page from CDN and renders the root UI element', async ({ page }) => {
    await page.goto('/game/game.html');

    // Main UI root element
    const root = page.locator('.LFroot');
    await expect(root).toBeAttached({ timeout: 15_000 });

    // Renderer/canvas element inside gameplay area
    const canvas = page.locator('canvas.canvas');
    await expect(canvas).toBeAttached();

    // Game config present and pointing at expected package
    const configText = await page.locator('#flf-config').textContent();
    expect(configText).toContain('"package":"LF2_19/"');

    // No fatal console errors
    expect(fatalErrors).toEqual([]);
  });

  test('serves the game over HTTPS', async ({ page }) => {
    await page.goto('/game/game.html');

    expect(page.url()).toMatch(/^https:\/\//);
  });

  test('serves static assets with proper content type', async ({ page }) => {
    const response = await page.goto('/game/game.html');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/html/i);
  });
});
