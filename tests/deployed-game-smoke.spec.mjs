import { test, expect } from 'playwright/test';

const lobbyBaseUrl = process.env.LOBBY_BASE_URL || 'https://dev.lf2-lobby.noidilin.dev';

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

    // Game config present and pointing at expected package and lobby
    const configText = await page.locator('#flf-config').textContent();
    expect(configText).toContain('"package":"LF2_19/"');
    expect(configText).toContain(`"url":"${lobbyBaseUrl}"`);

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

  test('opens the network menu and loads the deployed lobby iframe', async ({ page }) => {
    await openDeployedLobby(page);

    await expect(page.locator('.lobby')).toBeVisible();
    await expect(page.locator('.lobby_window')).toHaveAttribute('src', `${lobbyBaseUrl}/lobby`);
  });

  test('logs into the deployed lobby chat iframe', async ({ page }) => {
    await openDeployedLobby(page);

    const lobbyFrame = page.frameLocator('.lobby_window');
    await lobbyFrame.locator('.login .name').fill(`smoke-${Date.now()}`);
    await lobbyFrame.locator('.login .button').click();

    await expect(lobbyFrame.locator('.login')).toBeHidden();
    await expect(lobbyFrame.locator('.mess ul')).toContainText('Welcome to the F.LF Lobby');
  });
});

async function openDeployedLobby(page) {
  const protocolResponsePromise = page.waitForResponse(
    (response) => response.url() === `${lobbyBaseUrl}/protocol` && response.status() === 200,
  );

  await page.goto('/game/game.html');
  await page.locator('.LFroot').waitFor();

  const frontpageMenu = page.locator('.frontpage_content .F_sprite_group').first();
  await expect(frontpageMenu).toBeVisible();
  const menuBox = await frontpageMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  await page.mouse.click(menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height / 2);
  await expect(page.locator('.network_game')).toBeVisible();

  await expect(page.locator('.server_address')).toHaveValue(lobbyBaseUrl);
  await page.locator('.server_connect').click();

  const protocolResponse = await protocolResponsePromise;
  expect(protocolResponse.status()).toBe(200);
  const protocol = await protocolResponse.json();
  expect(protocol).toMatchObject({
    name: 'F.Lobby (WebSocket)',
    library: '/ws/network.js',
    path: '/peer',
    address: lobbyBaseUrl,
  });

  await expect(page.locator('.lobby')).toBeVisible();
  await expect(page.locator('.lobby_window')).toHaveAttribute('src', `${lobbyBaseUrl}/lobby`);
}
