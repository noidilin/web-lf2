import { test, expect } from 'playwright/test';

const lobbyBaseUrl = 'http://127.0.0.1:8001';

const expectedProtocol = {
  name: 'F.Lobby (WebSocket)',
  library: '/ws/network.js',
  port: 8001,
  path: '/peer',
  address: lobbyBaseUrl,
};

test.describe('game-to-lobby network menu smoke baseline', () => {
  test('opens the network menu and reaches the local F.Lobby protocol endpoint', async ({ page }) => {
    await openLocalLobby(page);

    await expect(page.locator('.lobby')).toBeVisible();
    await expect(page.locator('.lobby_window')).toHaveAttribute('src', `${lobbyBaseUrl}/lobby`);
  });

  test('logs into the local lobby chat iframe', async ({ page }) => {
    await openLocalLobby(page);

    const lobbyFrame = page.frameLocator('.lobby_window');
    await lobbyFrame.locator('.login .name').fill(`smoke-${Date.now()}`);
    await lobbyFrame.locator('.login .button').click();

    await expect(lobbyFrame.locator('.login')).toBeHidden();
    await expect(lobbyFrame.locator('.mess ul')).toContainText('Welcome to the F.LF Lobby');
  });
});

async function openLocalLobby(page) {
  const protocolResponsePromise = page.waitForResponse(
    (response) => response.url() === `${lobbyBaseUrl}/protocol` && response.status() === 200,
  );

  const params = new URLSearchParams({ server: lobbyBaseUrl });
  await page.goto(`/game/game.html?${params.toString()}`);
  await page.locator('.LFroot').waitFor();

  // Browser-automate the legacy sprite menu. The second item is the network game menu.
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
  expect(await protocolResponse.json()).toEqual(expectedProtocol);

  await expect(page.locator('.lobby')).toBeVisible();
  await expect(page.locator('.lobby_window')).toHaveAttribute('src', `${lobbyBaseUrl}/lobby`);
}
