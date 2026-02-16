# Playwright 詳細ガイド

## 目次

1. [Playwrightとは](#playwrightとは)
2. [環境構築](#環境構築)
3. [基本的な使い方](#基本的な使い方)
4. [Page Object Model](#page-object-model)
5. [セレクター戦略](#セレクター戦略)
6. [ユーザーインタラクション](#ユーザーインタラクション)
7. [アサーション](#アサーション)
8. [ネットワーク制御](#ネットワーク制御)
9. [認証とセッション管理](#認証とセッション管理)
10. [並列実行とシャーディング](#並列実行とシャーディング)
11. [Visual Regression Testing](#visual-regression-testing)
12. [デバッグとトラブルシューティング](#デバッグとトラブルシューティング)
13. [CI/CD統合](#cicd統合)
14. [ベストプラクティス](#ベストプラクティス)

---

## Playwrightとは

Playwrightは、Microsoftが開発した現代的なE2E（End-to-End）テスト自動化フレームワークです。Chromium、Firefox、WebKitの3つのブラウザエンジンをサポートし、信頼性の高い自動テストを実現します。

### 主な特徴

| 特徴 | 説明 |
|-----|------|
| **複数ブラウザ対応** | Chromium、Firefox、WebKit（Safari）をサポート |
| **自動待機** | 要素が準備できるまで自動的に待機 |
| **並列実行** | テストを並列実行して高速化 |
| **強力なデバッグ** | Trace Viewer、UI Mode、Inspector |
| **ネットワーク制御** | リクエスト/レスポンスのモックと監視 |
| **スクリーンショット/動画** | 失敗時の自動キャプチャ |

### プロジェクトでの位置づけ

```
テストトロフィー
┌─────────────────────────────────────────────────────────────┐
│ E2E Tests                                                   │ ← Playwright（5-10 Critical Paths）★このガイドの対象
├─────────────────────────────────────────────────────────────┤
│ Integration / Interaction Tests                             │ ← Storybook play function（UI単位）
├─────────────────────────────────────────────────────────────┤
│ Unit / Component Tests                                      │ ← Vitest + Testing Library
├─────────────────────────────────────────────────────────────┤
│ Static Analysis                                             │ ← TypeScript + ESLint
└─────────────────────────────────────────────────────────────┘
```

Playwrightは、テストトロフィーの最上段として**実際のユーザーフロー**を検証するために使用します。

| 目的 | 推奨ツール | 代表コマンド | 判断基準 |
|-----|-----------|------------|---------|
| UI部品のロジック検証 | Vitest | `pnpm test:run` | 単一コンポーネントで完結する |
| Story単位の操作検証 | Storybook Interaction | `pnpm storybook:test` | 1画面内の状態遷移を確認したい |
| 実サービス相当の導線検証 | Playwright E2E | `pnpm test:e2e` | 複数ページ・認証・決済などを確認したい |

---

## 環境構築

### 依存関係のインストール

```bash
# Playwright本体とテストランナー
pnpm add -D @playwright/test

# ブラウザインストール（Chromium、Firefox、WebKit）
pnpm exec playwright install

# Chromiumのみで運用する場合
# pnpm exec playwright install chromium

# 依存ライブラリも一緒にインストール（Linux/CI用）
pnpm exec playwright install-deps
```

### Playwright設定ファイル

```typescript title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e/tests',
  
  // テストファイルのパターン
  testMatch: '**/*.spec.ts',
  
  // 完全並列実行
  fullyParallel: true,
  
  // CI環境では .only を禁止
  forbidOnly: !!process.env.CI,
  
  // 失敗時のリトライ回数
  retries: process.env.CI ? 2 : 0,
  
  // 並列実行のワーカー数
  workers: process.env.CI ? 4 : undefined,
  
  // レポーター設定
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'], // コンソール出力
  ],
  
  // 共通設定
  use: {
    // ベースURL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // トレース記録（失敗時のみ）
    trace: 'on-first-retry',
    
    // スクリーンショット（失敗時のみ）
    screenshot: 'only-on-failure',
    
    // 動画（失敗時のみ）
    video: 'retain-on-failure',
    
    // タイムアウト設定
    actionTimeout: 10_000, // 10秒
    navigationTimeout: 30_000, // 30秒
    
    // ビューポート
    viewport: { width: 1280, height: 720 },
    
    // ロケール
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },

  // プロジェクト設定（複数ブラウザ）
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chromium固有の設定
        launchOptions: {
          args: ['--disable-dev-shm-usage'], // CI環境用
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // モバイルエミュレーション
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 2分
  },
  
  // グローバルタイムアウト
  timeout: 60_000, // 60秒
  
  // expect タイムアウト
  expect: {
    timeout: 5_000, // 5秒
  },
});
```

### ディレクトリ構造

```bash
e2e/
├── tests/                          # テストファイル
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── registration.spec.ts
│   ├── user/
│   │   ├── profile.spec.ts
│   │   └── settings.spec.ts
│   └── order/
│       └── checkout.spec.ts
├── pages/                          # Page Object Model
│   ├── LoginPage.ts
│   ├── RegistrationPage.ts
│   ├── DashboardPage.ts
│   └── ProfilePage.ts
├── fixtures/                       # テストフィクスチャ
│   ├── auth.fixture.ts
│   └── user.fixture.ts
└── utils/                          # ユーティリティ
    ├── helpers.ts
    └── test-data.ts
```

### package.json スクリプト

```json title="package.json"
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:report": "playwright show-report",
    "test:e2e:trace": "playwright show-trace",
    "storybook:test": "test-storybook"
  }
}
```

---

## 基本的な使い方

### 最初のテスト

```typescript title="e2e/tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test('ホームページが表示される', async ({ page }) => {
  // ページに移動
  await page.goto('/');

  // タイトルを確認
  await expect(page).toHaveTitle(/Welcome/);

  // 見出しを確認
  const heading = page.getByRole('heading', { name: 'ようこそ' });
  await expect(heading).toBeVisible();
});

test('ログインページに移動できる', async ({ page }) => {
  await page.goto('/');

  // ログインリンクをクリック
  await page.getByRole('link', { name: 'ログイン' }).click();

  // URLを確認
  await expect(page).toHaveURL(/.*login/);

  // フォームが表示されることを確認
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel('パスワード')).toBeVisible();
});
```

### テストの実行

```bash
# 全テスト実行
pnpm test:e2e

# UI Modeで実行（推奨：開発時）
pnpm test:e2e:ui

# ブラウザを表示して実行
pnpm test:e2e:headed

# デバッグモード
pnpm test:e2e:debug

# 特定のテストのみ実行
pnpm test:e2e login.spec.ts

# 特定のブラウザのみ
pnpm test:e2e:chromium
```

---

## Page Object Model

Page Object Modelは、ページ固有のロジックをクラスにカプセル化するデザインパターンです。テストコードの保守性と再利用性を向上させます。

### LoginPage の実装

```typescript title="e2e/pages/LoginPage.ts"
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('メールアドレス');
    this.passwordInput = page.getByLabel('パスワード');
    this.submitButton = page.getByRole('button', { name: 'ログイン' });
    this.errorMessage = page.getByRole('alert');
    this.forgotPasswordLink = page.getByRole('link', { name: 'パスワードを忘れた方' });
  }

  /**
   * ログインページに移動
   */
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * ログインを実行
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * ログイン成功を確認
   */
  async expectLoginSuccess() {
    await this.page.waitForURL(/.*dashboard/, { timeout: 10000 });
  }

  /**
   * エラーメッセージを確認
   */
  async expectErrorMessage(message: string) {
    await this.errorMessage.waitFor({ state: 'visible' });
    await expect(this.errorMessage).toContainText(message);
  }

  /**
   * パスワード再設定ページに移動
   */
  async goToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL(/.*forgot-password/);
  }
}
```

### DashboardPage の実装

```typescript title="e2e/pages/DashboardPage.ts"
import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly profileLink: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'ダッシュボード' });
    this.userMenu = page.getByRole('button', { name: 'ユーザーメニュー' });
    this.logoutButton = page.getByRole('menuitem', { name: 'ログアウト' });
    this.profileLink = page.getByRole('link', { name: 'プロフィール' });
    this.settingsLink = page.getByRole('link', { name: '設定' });
  }

  /**
   * ダッシュボードページに移動
   */
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * ページが表示されていることを確認
   */
  async expectToBeVisible() {
    await expect(this.heading).toBeVisible();
  }

  /**
   * ログアウトを実行
   */
  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
    await this.page.waitForURL(/.*login/);
  }

  /**
   * プロフィールページに移動
   */
  async goToProfile() {
    await this.profileLink.click();
    await this.page.waitForURL(/.*profile/);
  }

  /**
   * 設定ページに移動
   */
  async goToSettings() {
    await this.settingsLink.click();
    await this.page.waitForURL(/.*settings/);
  }
}
```

### Page Object Modelを使ったテスト

```typescript title="e2e/tests/auth/login.spec.ts"
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('ログイン機能', () => {
  test('正しい認証情報でログインできる', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // ログインページに移動
    await loginPage.goto();

    // ログイン実行
    await loginPage.login('test@example.com', 'password123');

    // ダッシュボードにリダイレクトされることを確認
    await loginPage.expectLoginSuccess();
    await dashboardPage.expectToBeVisible();
  });

  test('誤った認証情報ではログインできない', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('wrong@example.com', 'wrongpassword');

    // エラーメッセージが表示されることを確認
    await loginPage.expectErrorMessage('メールアドレスまたはパスワードが正しくありません');

    // ログインページに留まることを確認
    await expect(page).toHaveURL(/.*login/);
  });

  test('空のフォームでは送信できない', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // 空のまま送信ボタンをクリック
    await loginPage.submitButton.click();

    // HTML5バリデーションエラーを確認
    const emailValidity = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(emailValidity).toBe(false);
  });

  test('パスワード再設定ページに移動できる', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.goToForgotPassword();

    await expect(page).toHaveURL(/.*forgot-password/);
  });
});
```

---

## セレクター戦略

Playwrightは強力なセレクター機能を提供します。適切なセレクターを使うことで、保守性の高いテストを書けます。

### セレクター優先順位

```typescript
// 1. ロール（最優先）- アクセシビリティとセマンティクスを反映
await page.getByRole('button', { name: '送信' });
await page.getByRole('heading', { name: 'ようこそ' });
await page.getByRole('link', { name: 'ログイン' });

// 2. Label - フォーム要素に最適
await page.getByLabel('メールアドレス');
await page.getByLabel('パスワード');

// 3. Placeholder
await page.getByPlaceholder('名前を入力してください');

// 4. Text
await page.getByText('こんにちは');
await page.getByText(/正規表現/);

// 5. Test ID（最終手段）
await page.getByTestId('submit-button');

// 6. CSS Selector（避けるべき）
await page.locator('.submit-btn'); // 実装詳細に依存
```

### 複雑なセレクター

```typescript
// 組み合わせ
await page.getByRole('button', { name: '送信' }).and(page.locator('.primary'));

// フィルタリング
await page.getByRole('listitem').filter({ hasText: 'アクティブ' });

// 親要素からの相対位置
await page.locator('form').getByRole('button', { name: '送信' });

// n番目の要素
await page.getByRole('listitem').nth(2);
await page.getByRole('listitem').first();
await page.getByRole('listitem').last();

// カウント
const count = await page.getByRole('listitem').count();

// 複数要素の取得
const items = await page.getByRole('listitem').all();
for (const item of items) {
  await item.click();
}
```

### 動的コンテンツの待機

```typescript
// 要素が表示されるまで待機
await page.getByText('読み込み完了').waitFor({ state: 'visible' });

// 要素が非表示になるまで待機
await page.getByText('読み込み中...').waitFor({ state: 'hidden' });

// カスタム条件で待機
await page.waitForFunction(() => {
  return document.querySelectorAll('.item').length > 5;
});

// ネットワーク応答を待機
await page.waitForResponse(response => 
  response.url().includes('/api/users') && response.status() === 200
);

// URL変更を待機
await page.waitForURL(/.*dashboard/);
```

---

## ユーザーインタラクション

### 基本操作

```typescript
// クリック
await page.getByRole('button', { name: '送信' }).click();

// ダブルクリック
await page.getByRole('button').dblclick();

// 右クリック
await page.getByRole('button').click({ button: 'right' });

// ホバー
await page.getByRole('button').hover();

// フォーカス
await page.getByLabel('メールアドレス').focus();

// ブラー
await page.getByLabel('メールアドレス').blur();
```

### テキスト入力

```typescript
// 入力
await page.getByLabel('メールアドレス').fill('test@example.com');

// 既存テキストをクリアして入力
await page.getByLabel('検索').clear();
await page.getByLabel('検索').fill('新しい検索ワード');

// キーボード入力（1文字ずつ）
await page.getByLabel('名前').type('太郎', { delay: 100 });

// キーボードショートカット
await page.keyboard.press('Control+A');
await page.keyboard.press('Control+C');
await page.keyboard.press('Enter');
```

### フォーム操作

```typescript
// チェックボックス
await page.getByLabel('利用規約に同意する').check();
await page.getByLabel('利用規約に同意する').uncheck();

// ラジオボタン
await page.getByLabel('男性').check();

// セレクトボックス
await page.getByLabel('国').selectOption('日本');
await page.getByLabel('国').selectOption({ value: 'JP' });
await page.getByLabel('国').selectOption({ index: 0 });

// ファイルアップロード
await page.getByLabel('プロフィール画像').setInputFiles('./avatar.png');

// 複数ファイル
await page.getByLabel('添付ファイル').setInputFiles([
  './file1.pdf',
  './file2.pdf',
]);

// ファイル選択をクリア
await page.getByLabel('プロフィール画像').setInputFiles([]);
```

### ドラッグ&ドロップ

```typescript
// ドラッグ&ドロップ
await page.getByText('アイテム1').dragTo(page.getByText('カテゴリA'));

// 座標指定でドラッグ
await page.getByText('アイテム1').dragTo(page.locator('.drop-zone'), {
  targetPosition: { x: 50, y: 50 },
});
```

### スクロール

```typescript
// 要素までスクロール
await page.getByText('フッター').scrollIntoViewIfNeeded();

// ページ全体をスクロール
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

// 特定の位置までスクロール
await page.evaluate(() => window.scrollTo(0, 500));
```

---

## アサーション

Playwrightは強力なアサーション機能を提供します。自動リトライにより、Flaky Testsを防ぎます。

### 要素の状態

```typescript
// 表示されている
await expect(page.getByText('成功しました')).toBeVisible();

// 非表示
await expect(page.getByText('読み込み中...')).toBeHidden();

// 有効
await expect(page.getByRole('button', { name: '送信' })).toBeEnabled();

// 無効
await expect(page.getByRole('button', { name: '送信' })).toBeDisabled();

// チェックされている
await expect(page.getByLabel('利用規約に同意する')).toBeChecked();

// 編集可能
await expect(page.getByLabel('名前')).toBeEditable();

// フォーカスされている
await expect(page.getByLabel('メールアドレス')).toBeFocused();
```

### テキスト検証

```typescript
// テキストを含む
await expect(page.getByRole('heading')).toContainText('ようこそ');

// 完全一致
await expect(page.getByRole('heading')).toHaveText('ようこそ、太郎さん');

// 正規表現
await expect(page.getByRole('alert')).toHaveText(/エラー: .+/);

// 複数要素のテキスト
await expect(page.getByRole('listitem')).toHaveText([
  'アイテム1',
  'アイテム2',
  'アイテム3',
]);
```

### 属性検証

```typescript
// 属性値
await expect(page.getByRole('link')).toHaveAttribute('href', '/about');

// 属性値（正規表現）
await expect(page.getByRole('img')).toHaveAttribute('src', /\.jpg$/);

// クラス
await expect(page.getByRole('button')).toHaveClass('btn-primary');
await expect(page.getByRole('button')).toHaveClass(/btn-.+/);

// CSS
await expect(page.getByRole('button')).toHaveCSS('color', 'rgb(255, 0, 0)');

// ID
await expect(page.locator('div')).toHaveId('main-content');
```

### フォーム値

```typescript
// 入力値
await expect(page.getByLabel('メールアドレス')).toHaveValue('test@example.com');

// 入力値（正規表現）
await expect(page.getByLabel('電話番号')).toHaveValue(/^\d{3}-\d{4}-\d{4}$/);

// セレクトボックス
await expect(page.getByLabel('国')).toHaveValue('JP');
```

### ページレベル

```typescript
// URL
await expect(page).toHaveURL('http://localhost:3000/dashboard');
await expect(page).toHaveURL(/.*dashboard/);

// タイトル
await expect(page).toHaveTitle('ダッシュボード | My App');
await expect(page).toHaveTitle(/Dashboard/);

// スクリーンショット比較
await expect(page).toHaveScreenshot('dashboard.png');
```

### カウント

```typescript
// 要素数
await expect(page.getByRole('listitem')).toHaveCount(5);

// 0件
await expect(page.getByRole('listitem')).toHaveCount(0);

// 範囲
const count = await page.getByRole('listitem').count();
expect(count).toBeGreaterThan(0);
expect(count).toBeLessThanOrEqual(10);
```

---

## ネットワーク制御

`page.route()` は E2E の補助用途に限定します。UI状態（Loading/Error/Emptyなど）の網羅は、Storybook + MSW または Vitest + MSW に寄せて、E2Eとの重複を避けます。

### リクエストのモック

```typescript
import { test, expect } from '@playwright/test';

test('APIレスポンスをモックする', async ({ page }) => {
  // /api/users へのリクエストをモック
  await page.route('/api/users', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ]),
    });
  });

  await page.goto('/users');

  // モックデータが表示されることを確認
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
});

test('APIエラーをシミュレートする', async ({ page }) => {
  await page.route('/api/users', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'サーバーエラー' }),
    });
  });

  await page.goto('/users');

  // エラーメッセージが表示されることを確認
  await expect(page.getByText('エラーが発生しました')).toBeVisible();
});
```

### リクエストの監視

```typescript
test('APIリクエストを検証する', async ({ page }) => {
  // リクエストをキャプチャ
  const requests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  await page.goto('/users');
  await page.getByRole('button', { name: 'ユーザー追加' }).click();
  await page.getByLabel('名前').fill('Charlie');
  await page.getByRole('button', { name: '保存' }).click();

  // POSTリクエストが送信されたことを確認
  const postRequest = requests.find(
    req => req.method === 'POST' && req.url.includes('/api/users')
  );
  expect(postRequest).toBeDefined();
  expect(JSON.parse(postRequest.postData)).toMatchObject({
    name: 'Charlie',
  });
});

test('APIレスポンスを待機する', async ({ page }) => {
  await page.goto('/users');

  // レスポンスを待機
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/users') && response.status() === 200
  );

  await page.getByRole('button', { name: '再読み込み' }).click();

  const response = await responsePromise;
  const data = await response.json();

  expect(data).toBeInstanceOf(Array);
  expect(data.length).toBeGreaterThan(0);
});
```

### ネットワーク条件のシミュレート

```typescript
test('オフライン状態をシミュレートする', async ({ page, context }) => {
  await page.goto('/');

  // オフラインに設定
  await context.setOffline(true);

  await page.getByRole('button', { name: '更新' }).click();

  // オフライン時のメッセージを確認
  await expect(page.getByText('ネットワークに接続できません')).toBeVisible();

  // オンラインに戻す
  await context.setOffline(false);
});

test('遅いネットワークをシミュレートする', async ({ page }) => {
  // 遅延を追加
  await page.route('**/*', async route => {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒遅延
    await route.continue();
  });

  await page.goto('/');

  // ローディング表示を確認
  await expect(page.getByText('読み込み中...')).toBeVisible();
});
```

---

## 認証とセッション管理

### ログイン状態の保存

```typescript title="e2e/fixtures/auth.fixture.ts"
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

// 認証済みユーザーのフィクスチャ
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);

    // ログイン実行
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');
    await loginPage.expectLoginSuccess();

    // テストで使用
    await use(page);

    // クリーンアップ不要（自動的にブラウザが閉じる）
  },
});

export { expect } from '@playwright/test';
```

```typescript title="e2e/tests/user/profile.spec.ts"
import { test, expect } from '../../fixtures/auth.fixture';
import { ProfilePage } from '../../pages/ProfilePage';

// このテストは認証済み状態で開始される
test('プロフィールを更新できる', async ({ authenticatedPage }) => {
  const profilePage = new ProfilePage(authenticatedPage);

  await profilePage.goto();
  await profilePage.updateName('新しい名前');
  await profilePage.save();

  await expect(profilePage.successMessage).toBeVisible();
});
```

### ストレージ状態の保存と再利用

```typescript title="e2e/utils/auth.setup.ts"
import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');
  await loginPage.expectLoginSuccess();

  // ストレージ状態を保存
  await page.context().storageState({ path: authFile });
});
```

```typescript title="playwright.config.ts"
export default defineConfig({
  // セットアップを実行
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 保存した認証状態を使用
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'], // setup完了後に実行
    },
  ],
});
```

### 複数ユーザーの管理

```typescript title="e2e/fixtures/multi-user.fixture.ts"
import { test as base } from '@playwright/test';

type UserRole = 'admin' | 'user' | 'guest';

export const test = base.extend<{ userRole: UserRole }>({
  userRole: ['user', { option: true }],

  page: async ({ page, userRole }, use) => {
    // ロールに応じた認証情報を使用
    const credentials = {
      admin: { email: 'admin@example.com', password: 'admin123' },
      user: { email: 'user@example.com', password: 'user123' },
      guest: { email: 'guest@example.com', password: 'guest123' },
    };

    const { email, password } = credentials[userRole];

    // ログイン処理
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill(password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL(/.*dashboard/);

    await use(page);
  },
});
```

```typescript title="e2e/tests/admin/users.spec.ts"
import { test, expect } from '../../fixtures/multi-user.fixture';

test.use({ userRole: 'admin' }); // 管理者として実行

test('管理者はユーザー一覧を表示できる', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();
});
```

---

## 並列実行とシャーディング

### 並列実行の設定

```typescript title="playwright.config.ts"
export default defineConfig({
  // 完全並列実行
  fullyParallel: true,

  // ワーカー数（並列実行数）
  workers: process.env.CI ? 4 : undefined,

  // ファイル内並列実行
  // デフォルトでは同一ファイル内のテストは順次実行される
});
```

### テストの並列実行制御

```typescript
import { test } from '@playwright/test';

// このファイルのテストを順次実行
test.describe.configure({ mode: 'serial' });

test.describe('ユーザー登録フロー', () => {
  test('ステップ1: アカウント情報入力', async ({ page }) => {
    // ...
  });

  test('ステップ2: プロフィール情報入力', async ({ page }) => {
    // ステップ1の後に実行される
  });

  test('ステップ3: 確認', async ({ page }) => {
    // ステップ2の後に実行される
  });
});
```

### シャーディング（CI環境での並列実行）

```yaml title=".gitlab-ci.yml"
test:e2e:
  parallel: 4 # 4つのジョブに分割
  script:
    - pnpm exec playwright test --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
```

```bash
# ローカルでシャーディングをテスト
pnpm exec playwright test --shard=1/4
pnpm exec playwright test --shard=2/4
pnpm exec playwright test --shard=3/4
pnpm exec playwright test --shard=4/4
```

### テストの分離

```typescript
test.describe('ユーザー管理', () => {
  // 各テストで新しいページを使用
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('テスト1', async ({ page }) => {
    // この page は独立したコンテキスト
  });

  test('テスト2', async ({ page }) => {
    // この page も独立したコンテキスト
  });
});
```

---

## Visual Regression Testing

### スクリーンショット比較

```typescript
import { test, expect } from '@playwright/test';

test('ホームページの見た目が変わっていない', async ({ page }) => {
  await page.goto('/');

  // ページ全体のスクリーンショット
  await expect(page).toHaveScreenshot('homepage.png');
});

test('ボタンの見た目が変わっていない', async ({ page }) => {
  await page.goto('/');

  // 特定要素のスクリーンショット
  await expect(page.getByRole('button', { name: '送信' })).toHaveScreenshot('submit-button.png');
});

test('レスポンシブデザインが正しい', async ({ page }) => {
  await page.goto('/');

  // モバイルサイズ
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page).toHaveScreenshot('homepage-mobile.png');

  // タブレットサイズ
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page).toHaveScreenshot('homepage-tablet.png');

  // デスクトップサイズ
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page).toHaveScreenshot('homepage-desktop.png');
});
```

### スクリーンショットのオプション

```typescript
test('カスタムスクリーンショット設定', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveScreenshot('custom.png', {
    // 最大許容差分（0-1）
    maxDiffPixels: 100,

    // 最大許容差分率（0-1）
    maxDiffPixelRatio: 0.1,

    // アニメーションを無効化
    animations: 'disabled',

    // フルページ
    fullPage: true,

    // マスク（除外領域）
    mask: [page.getByText('現在時刻')], // 時刻表示などの動的要素を除外
  });
});
```

### ベースライン更新

```bash
# ベースラインスクリーンショットを更新
pnpm exec playwright test --update-snapshots

# 特定のテストのみ更新
pnpm exec playwright test homepage.spec.ts --update-snapshots
```

---

## デバッグとトラブルシューティング

### UI Mode（推奨）

```bash
# UI Modeで実行
pnpm test:e2e:ui
```

UI Modeでは以下が可能です：
- テストをステップ実行
- 各ステップのDOM状態を確認
- ネットワークリクエストを監視
- コンソールログを確認
- タイムトラベルデバッグ

### Debug Mode

```bash
# デバッグモードで実行
pnpm test:e2e:debug

# 特定のテストのみデバッグ
pnpm exec playwright test login.spec.ts --debug
```

### Trace Viewer

```bash
# 失敗したテストのtraceを表示
pnpm exec playwright show-trace test-results/.../trace.zip
```

Trace Viewerでは以下を確認できます：
- 各アクションの実行時間
- DOM スナップショット
- ネットワークログ
- コンソールログ
- スクリーンショット

### テストコード内でのデバッグ

```typescript
import { test, expect } from '@playwright/test';

test('デバッグ例', async ({ page }) => {
  await page.goto('/');

  // ブラウザを一時停止してDevToolsを開く
  await page.pause();

  // 要素の情報を出力
  const button = page.getByRole('button', { name: '送信' });
  console.log(await button.textContent());
  console.log(await button.getAttribute('class'));

  // スクリーンショット保存
  await page.screenshot({ path: 'debug.png' });

  // ページのHTML取得
  const html = await page.content();
  console.log(html);

  // 特定要素のHTML取得
  const formHtml = await page.locator('form').innerHTML();
  console.log(formHtml);
});
```

### よくあるエラーと解決策

```typescript
// タイムアウトエラーの対処
test('タイムアウト対策', async ({ page }) => {
  // 個別のアクションタイムアウト延長
  await page.getByText('遅い要素').click({ timeout: 30000 });

  // テスト全体のタイムアウト延長
  test.setTimeout(120000); // 2分

  // 要素の準備を明示的に待機
  await page.getByRole('button', { name: '送信' }).waitFor({ state: 'visible' });
});

// Flaky Testの対処
test('安定したテスト', async ({ page }) => {
  await page.goto('/');

  // ❌ BAD: 固定待機時間
  // await page.waitForTimeout(3000);

  // ✅ GOOD: ネットワーク応答を待機
  await page.waitForResponse(response => 
    response.url().includes('/api/users') && response.status() === 200
  );

  // ✅ GOOD: 要素の状態を待機
  await page.getByText('読み込み完了').waitFor({ state: 'visible' });
});
```

---

## CI/CD統合

### GitLab CI設定

```yaml title=".gitlab-ci.yml"
stages:
  - test

# E2Eテスト（並列実行）
test:e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.0-jammy
  parallel: 4
  before_script:
    - corepack enable
    - pnpm install --frozen-lockfile
  script:
    # アプリケーションビルド
    - pnpm build
    
    # E2Eテスト実行（シャーディング）
    - pnpm exec playwright test --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
  after_script:
    # 失敗時のデバッグ情報収集
    - ls -la test-results/ || true
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    reports:
      junit: test-results/junit.xml
    expire_in: 7 days
  only:
    - merge_requests
    - main
```

### GitHub Actions設定

```yaml title=".github/workflows/e2e.yml"
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run Playwright tests
        run: pnpm exec playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.shardIndex }}
          path: playwright-report/
          retention-days: 7
```

### Storybook InteractionとのCI分離

- `test:e2e` はCritical Path保証専用にする
- `storybook:test` はコンポーネント操作回帰専用にする
- 2つを別ジョブに分離し、失敗時の責務を明確にする

---

## ベストプラクティス

### 1. Page Object Model を活用

```typescript
// ✅ GOOD: Page Object Model
const loginPage = new LoginPage(page);
await loginPage.login('test@example.com', 'password123');

// ❌ BAD: ベタ書き
await page.getByLabel('メールアドレス').fill('test@example.com');
await page.getByLabel('パスワード').fill('password123');
await page.getByRole('button', { name: 'ログイン' }).click();
```

### 2. セマンティックなセレクターを使用

```typescript
// ✅ GOOD: ロール、ラベル
await page.getByRole('button', { name: '送信' });
await page.getByLabel('メールアドレス');

// ❌ BAD: CSSセレクター
await page.locator('.submit-btn');
await page.locator('#email-input');
```

### 3. 適切な待機

```typescript
// ✅ GOOD: 自動待機
await expect(page.getByText('成功')).toBeVisible();

// ✅ GOOD: ネットワーク待機
await page.waitForResponse(r => r.url().includes('/api/users'));

// ❌ BAD: 固定待機
await page.waitForTimeout(3000);
```

### 4. テストの独立性

```typescript
// ✅ GOOD: 各テストで状態をリセット
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // 必要な初期化処理
});

// ❌ BAD: テスト間で状態共有
let userData: any;
test('test1', async ({ page }) => {
  userData = await page.evaluate(() => window.localStorage.getItem('user'));
});
test('test2', async ({ page }) => {
  // test1に依存
});
```

### 5. 意味のあるテスト名

```typescript
// ✅ GOOD
test('未入力の状態では送信ボタンが無効になる', async ({ page }) => {});
test('管理者ユーザーは全ユーザーを削除できる', async ({ page }) => {});

// ❌ BAD
test('test1', async ({ page }) => {});
test('button disabled', async ({ page }) => {});
```

### 6. Critical Pathに集中

```typescript
// E2Eテストは以下に集中
// ✅ ユーザー登録フロー
// ✅ ログイン/ログアウト
// ✅ 決済フロー
// ✅ データ作成・更新・削除

// ❌ すべてのエッジケース（Unit Testで対応）
// ❌ UIの細かいバリエーション（Storybookで対応）
```

### 6.1 Storybook/Vitestとの重複を避ける

```typescript
// ✅ GOOD: E2Eは「ユーザー価値の完了条件」を検証
test('購入が完了し、注文履歴に反映される', async ({ page }) => {});

// ❌ BAD: 同じ見た目バリエーションをE2Eで再検証
test('ローディングスピナーの色が正しい', async ({ page }) => {});
```

### 7. 並列実行を活用

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
});
```

### 8. リトライの適切な設定

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // CI環境のみリトライ
});
```

---

## まとめ

このガイドでは、Playwrightを使ったE2Eテストの基本から実践的なテクニックまでを説明しました。

### 重要なポイント

1. **Page Object Modelでテストコードを整理する**
2. **セマンティックなセレクターを優先する**
3. **自動待機を活用し、固定待機を避ける**
4. **Critical Pathに集中し、5-10本程度に絞る**
5. **並列実行とシャーディングで高速化する**
6. **UI ModeとTrace Viewerでデバッグする**
7. **Storybook/Vitestと責務を重複させない**
8. **CI/CD統合で継続的にテストする**

### 次のステップ

- [Storybook詳細ガイド](./storybook-guide.md) - UIカタログとインタラクションテスト
- [MSW詳細ガイド](./msw-guide.md) - APIモックの詳細
- [トラブルシューティング](./troubleshooting.md) - 問題解決ガイド

---

**困ったときは [トラブルシューティング](./troubleshooting.md) または [FAQ](./faq.md) を参照してください。**
