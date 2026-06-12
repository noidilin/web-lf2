import { test, expect } from 'playwright/test';

// Known non-fatal console noise from the legacy game client
const KNOWN_NOISE = [
  /Cross-Origin .* blocked/i,
  /Loading failed for the .* script/i,
  /Failed to load resource: net::ERR_NETWORK_CHANGED/i,
];

test.describe('game smoke baseline', () => {
  const fatalErrors = [];

  test.beforeEach(async ({ page }) => {
    fatalErrors.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const isKnownNoise = KNOWN_NOISE.some((pattern) => pattern.test(text));
        if (!isKnownNoise) {
          fatalErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      fatalErrors.push(error.message);
    });
  });

  test('loads the game page and renders the root UI element', async ({ page }) => {
    await page.goto('/game/game.html');

    // Main UI root element
    const root = page.locator('.LFroot');
    await expect(root).toBeAttached();

    // Renderer/canvas element inside gameplay area
    const canvas = page.locator('canvas.canvas');
    await expect(canvas).toBeAttached();

    // Game config present and pointing at expected package
    const configText = await page.locator('#flf-config').textContent();
    expect(configText).toContain('"package":"LF2_19/"');

    // No fatal console errors
    expect(fatalErrors).toEqual([]);
  });

  test('saves a screenshot for baseline comparison', async ({ page }) => {
    await page.goto('/game/game.html');
    await page.locator('.LFroot').waitFor();

    await page.screenshot({
      path: 'tests/screenshots/game-smoke-baseline.png',
      fullPage: true,
    });
  });
});
