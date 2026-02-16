import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('ログイン成功メッセージを表示できる', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  await expect(page.getByRole('status')).toHaveText('ログイン成功');
});
