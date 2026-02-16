# トラブルシューティングガイド

## 目次

1. [環境構築の問題](#環境構築の問題)
2. [Vitestの問題](#vitestの問題)
3. [Playwrightの問題](#playwrightの問題)
4. [Storybookの問題](#storybookの問題)
5. [MSWの問題](#mswの問題)
6. [Factoryの問題](#factoryの問題)
7. [CI/CDの問題](#cicdの問題)
8. [パフォーマンスの問題](#パフォーマンスの問題)
9. [よくあるエラーメッセージ](#よくあるエラーメッセージ)

---

## 環境構築の問題

### Node.jsバージョンの問題

**症状:**
```bash
error: Unsupported engine
```

**原因:**
Node.jsのバージョンが要件を満たしていない

**解決策:**
```bash
# Node.jsバージョン確認
node --version

# 最低: v18.x / 推奨: v20.x以上をインストール
# nvmを使用している場合
nvm install 20
nvm use 20

# .nvmrcファイルを確認
cat .nvmrc
```

### pnpmインストールの問題

**症状:**
```bash
command not found: pnpm
```

**解決策:**
```bash
# pnpmをグローバルインストール
npm install -g pnpm@9

# またはcorepackを使用（推奨）
corepack enable
corepack prepare pnpm@9 --activate

# バージョン確認
pnpm --version
```

### 依存関係のインストール失敗

**症状:**
```bash
ERR_PNPM_FETCH_404
```

**解決策:**
```bash
# キャッシュクリア
pnpm store prune

# lockfileを削除して再インストール
rm pnpm-lock.yaml
pnpm install

# Nodeモジュールも削除して完全再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScriptパスエイリアスが解決されない

**症状:**
```
Cannot find module '@/components/Button'
```

**解決策:**

```json title="tsconfig.json"
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript title="playwright.config.ts"
// Playwrightはtsconfig.jsonを自動的に読み込む
// 追加設定不要
```

---

## Vitestの問題

### `Cannot find module` エラー

**症状:**
```
Error: Cannot find module '@/components/Button'
```

**解決策:**

1. **vitest.config.ts の確認:**
```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

2. **tsconfig.json の確認:**
```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### ESMモジュールのエラー

**症状:**
```
SyntaxError: Cannot use import statement outside a module
```

**解決策:**

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

```json title="package.json"
{
  "type": "module"
}
```

### MSWハンドラーが動作しない

**症状:**
テストでAPIリクエストが実際に送信されてしまう

**解決策:**

1. **setup.ts でMSWサーバーを起動:**
```typescript title="src/tests/setup.ts"
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

2. **vitest.config.ts で setup.ts を読み込み:**
```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
  },
});
```

### react-queryのキャッシュ問題

**症状:**
テスト間でキャッシュが残り、予期しない結果になる

**解決策:**

```typescript title="src/components/UserCard/UserCard.test.tsx"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // キャッシュを即座に削除
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

test('test1', () => {
  render(<UserCard userId="1" />, { wrapper: createWrapper() });
  // 独立したQueryClient
});

test('test2', () => {
  render(<UserCard userId="1" />, { wrapper: createWrapper() });
  // 新しいQueryClient
});
```

### カバレッジが収集されない

**症状:**
`pnpm test:coverage` を実行してもカバレッジが0%

**解決策:**

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/types/**',
        '**/*.d.ts',
      ],
    },
  },
});
```

### `ReferenceError: document is not defined`

**症状:**
```
ReferenceError: document is not defined
```

**解決策:**

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    environment: 'jsdom', // または 'happy-dom'
  },
});
```

---

## Playwrightの問題

### ブラウザがインストールされていない

**症状:**
```
browserType.launch: Executable doesn't exist
```

**解決策:**
```bash
# Chromiumのみインストール
pnpm exec playwright install chromium

# すべてのブラウザをインストール
pnpm exec playwright install

# 依存関係も含めてインストール（Linux/CI用）
pnpm exec playwright install-deps
```

### タイムアウトエラー

**症状:**
```
Test timeout of 30000ms exceeded
```

**解決策:**

1. **グローバルタイムアウトを延長:**
```typescript title="playwright.config.ts"
export default defineConfig({
  timeout: 60_000, // 60秒
  use: {
    actionTimeout: 10_000, // 10秒
    navigationTimeout: 30_000, // 30秒
  },
});
```

2. **特定のテストのみ延長:**
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(120_000); // 120秒

  await page.goto('/slow-page');
});
```

3. **明示的な待機を追加:**
```typescript
// ❌ BAD: 固定待機
await page.waitForTimeout(5000);

// ✅ GOOD: 条件待機
await page.waitForResponse(response => 
  response.url().includes('/api/users') && response.status() === 200
);

await page.getByText('読み込み完了').waitFor({ state: 'visible' });
```

### Flaky Tests（不安定なテスト）

**症状:**
テストが時々成功し、時々失敗する

**解決策:**

1. **明示的な待機:**
```typescript
// ❌ BAD
await page.click('button');
await page.getByText('成功').toBeVisible(); // 即座に確認

// ✅ GOOD
await page.click('button');
await page.waitForResponse(r => r.url().includes('/api/submit'));
await expect(page.getByText('成功')).toBeVisible();
```

2. **自動リトライ設定:**
```typescript title="playwright.config.ts"
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
});
```

3. **ページ読み込み完了を待機:**
```typescript
await page.goto('/');
await page.waitForLoadState('networkidle');
```

### セレクターが見つからない

**症状:**
```
Error: Locator not found
```

**解決策:**

1. **セレクターの優先順位を確認:**
```typescript
// ✅ GOOD: ロール（推奨）
await page.getByRole('button', { name: '送信' });

// ✅ GOOD: Label
await page.getByLabel('メールアドレス');

// ⚠️ OK: TestId（最終手段）
await page.getByTestId('submit-button');

// ❌ BAD: CSSセレクター
await page.locator('.submit-btn');
```

2. **要素の存在を確認:**
```typescript
// 存在確認
const button = page.getByRole('button', { name: '送信' });
await expect(button).toBeVisible();

// カウント確認
const items = page.getByRole('listitem');
console.log(await items.count());
```

### CI環境でのみ失敗する

**症状:**
ローカルでは成功するがCI環境で失敗する

**解決策:**

1. **ヘッドレスモードを統一:**
```typescript title="playwright.config.ts"
export default defineConfig({
  use: {
    headless: true, // CI環境と同じ設定でローカルテスト
  },
});
```

```bash
# ローカルでヘッドレス実行
pnpm exec playwright test --headed=false
```

2. **CI専用の設定:**
```typescript title="playwright.config.ts"
export default defineConfig({
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: process.env.CI ? 'on-first-retry' : 'off',
  },
});
```

3. **ビューポートサイズを固定:**
```typescript title="playwright.config.ts"
export default defineConfig({
  use: {
    viewport: { width: 1280, height: 720 },
  },
});
```

---

## Storybookの問題

### Storybookが起動しない

**症状:**
```
Error: Cannot find module '@storybook/nextjs'
```

**解決策:**
```bash
# Storybook依存関係の再インストール
pnpm add -D storybook @storybook/nextjs @storybook/addon-essentials

# キャッシュクリア
rm -rf node_modules/.cache
pnpm storybook
```

### Storiesが表示されない

**症状:**
Storybookは起動するがストーリーが表示されない

**解決策:**

1. **stories設定を確認:**
```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
};
```

2. **Storyファイルの命名を確認:**
```bash
# ✅ GOOD
Button.stories.tsx
UserCard.stories.tsx

# ❌ BAD
Button.story.tsx
ButtonStories.tsx
```

### MSWが動作しない

**症状:**
Storybook内でAPIリクエストが実際に送信される

**解決策:**

1. **msw-storybook-addonをインストール:**
```bash
pnpm add -D msw-storybook-addon
```

2. **MSW初期化:**
```typescript title=".storybook/preview.tsx"
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/tests/msw/handlers';

initialize({
  onUnhandledRequest: 'warn',
});

const preview: Preview = {
  parameters: {
    msw: {
      handlers: handlers,
    },
  },
  loaders: [mswLoader],
};

export default preview;
```

3. **Service Workerファイルを生成:**
```bash
pnpm exec msw init public/ --save
```

### ビルドが遅い

**症状:**
Storybookのビルドに数分かかる

**解決策:**

1. **キャッシュ無効化:**
```bash
pnpm exec storybook build --no-manager-cache
```

2. **不要なアドオン削除:**
```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials', // 必須のみ
    // 不要なアドオンをコメントアウト
  ],
};
```

3. **Storyの数を減らす:**
```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  stories: [
    // 開発時は特定のディレクトリのみ
    process.env.NODE_ENV === 'development'
      ? '../src/components/Button/**/*.stories.tsx'
      : '../src/**/*.stories.tsx',
  ],
};
```

### Interaction Testsが実行されない

**症状:**
`play` 関数が実行されない

**解決策:**

1. **@storybook/addon-interactionsをインストール:**
```bash
pnpm add -D @storybook/addon-interactions
```

2. **アドオン追加:**
```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions', // 追加
  ],
};
```

3. **@storybook/testをインポート:**
```typescript title="Button.stories.tsx"
import { within, userEvent, expect } from '@storybook/test';

export const WithInteraction: Story = {
  name: 'インタラクション確認',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('Clicked')).toBeInTheDocument();
  },
};
```

---

## MSWの問題

### ハンドラーが呼ばれない

**症状:**
MSWハンドラーを定義したのにリクエストが通過する

**解決策:**

1. **URLパスの確認:**
```typescript
// ❌ BAD: 完全URL指定
http.get('http://localhost:3000/api/users', ...)

// ✅ GOOD: パスのみ
http.get('/api/users', ...)
```

2. **ハンドラーの順序:**
```typescript
// ❌ BAD: 広いパターンが先
export const handlers = [
  http.get('/api/*', () => { ... }), // すべてキャッチ
  http.get('/api/users', () => { ... }), // 到達しない
];

// ✅ GOOD: 具体的なパターンが先
export const handlers = [
  http.get('/api/users', () => { ... }),
  http.get('/api/*', () => { ... }),
];
```

3. **server.listen()の確認:**
```typescript title="src/tests/setup.ts"
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' }); // エラー表示
});
```

### リクエストボディが取得できない

**症状:**
`request.json()` が空オブジェクトを返す

**解決策:**

```typescript
// ✅ GOOD: async/await使用
http.post('/api/users', async ({ request }) => {
  const body = await request.json(); // await必須
  console.log(body);
  return HttpResponse.json({ ...body });
});

// ❌ BAD: awaitなし
http.post('/api/users', ({ request }) => {
  const body = request.json(); // Promise<any>
  console.log(body); // [object Promise]
});
```

### CORSエラー

**症状:**
```
Access to fetch has been blocked by CORS policy
```

**解決策:**

```typescript
http.get('/api/users', () => {
  return HttpResponse.json(
    { data: [] },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
});
```

### 遅延が効かない

**症状:**
`delay()` を使っているのに即座にレスポンスが返る

**解決策:**

```typescript
import { delay, http, HttpResponse } from 'msw';

// ✅ GOOD: async/await
http.get('/api/users', async () => {
  await delay(1000); // await必須
  return HttpResponse.json([]);
});

// ❌ BAD: awaitなし
http.get('/api/users', () => {
  delay(1000); // 効果なし
  return HttpResponse.json([]);
});
```

---

## Factoryの問題

### Factoryが型エラーを出す

**症状:**
```
Type 'X' is not assignable to type 'Y'
```

**解決策:**

```typescript
// ✅ GOOD: 明示的な型指定
export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      ...overrides,
    };
  },
};

// 型推論を確認
const user = userFactory.build(); // User型
```

### fakerのデータが日本語にならない

**症状:**
名前や住所が英語で生成される

**解決策:**

```typescript title="src/tests/factories/helpers/faker.ts"
import { faker } from '@faker-js/faker';

// 日本語ロケール設定
faker.locale = 'ja';

export { faker };
```

```typescript
// 使用例
import { faker } from './helpers/faker';

const name = faker.person.fullName(); // "山田 太郎"
const city = faker.location.city(); // "東京都"
```

### 毎回異なるデータが生成される

**症状:**
テストの再現性がない

**解決策:**

```typescript title="src/tests/factories/helpers/faker.ts"
import { faker } from '@faker-js/faker';

// Seed固定で決定的なデータ生成
faker.seed(123);

export { faker };
```

```typescript
// beforeEachでリセット（オプション）
import { beforeEach } from 'vitest';
import { faker } from '@faker-js/faker';

beforeEach(() => {
  faker.seed(123);
});
```

### 関連データの循環参照

**症状:**
```
RangeError: Maximum call stack size exceeded
```

**解決策:**

```typescript
// ❌ BAD: 循環参照
export const userFactory = {
  build: (): User => ({
    id: faker.string.uuid(),
    posts: postFactory.buildList(5), // ←
  }),
};

export const postFactory = {
  build: (): Post => ({
    id: faker.string.uuid(),
    author: userFactory.build(), // ← 循環
  }),
};

// ✅ GOOD: IDのみ生成
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    ...overrides,
    // postsは含めない
  }),
};

export const postFactory = {
  build: (overrides?: Partial<Post>): Post => ({
    id: faker.string.uuid(),
    authorId: faker.string.uuid(), // IDのみ
    ...overrides,
  }),

  // 関連データ付きで生成する専用メソッド
  buildWithAuthor: (author?: User): Post => {
    const actualAuthor = author || userFactory.build();
    return postFactory.build({
      authorId: actualAuthor.id,
    });
  },
};
```

---

## CI/CDの問題

### GitLab CI でテストが失敗する

**症状:**
ローカルでは成功するがGitLab CIで失敗

**解決策:**

1. **Node.jsバージョンを統一:**
```yaml title=".gitlab-ci.yml"
test:
  image: node:20 # ローカルと同じバージョン
  script:
    - node --version
    - pnpm test
```

2. **依存関係のキャッシュ:**
```yaml title=".gitlab-ci.yml"
variables:
  PNPM_VERSION: "9"

.node_cache: &node_cache
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .pnpm-store
      - node_modules/

test:
  <<: *node_cache
  before_script:
    - corepack enable
    - corepack prepare pnpm@${PNPM_VERSION} --activate
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile
```

### Playwright がCI環境で失敗する

**症状:**
```
browserType.launch: Executable doesn't exist
```

**解決策:**

```yaml title=".gitlab-ci.yml"
test:e2e:
  image: mcr.microsoft.com/playwright:v1.49.0-jammy
  before_script:
    - corepack enable
    - pnpm install --frozen-lockfile
    # ブラウザは既にイメージに含まれている
  script:
    - pnpm exec playwright test
```

### CI実行時間が長すぎる

**症状:**
テスト実行に30分以上かかる

**解決策:**

1. **並列実行:**
```yaml title=".gitlab-ci.yml"
test:unit:
  parallel: 4
  script:
    - pnpm test --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}

test:e2e:
  parallel: 4
  script:
    - pnpm exec playwright test --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
```

2. **キャッシュ活用:**
```yaml
test:
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .next/cache/
      - playwright/.cache/
```

---

## パフォーマンスの問題

### Vitestの実行が遅い

**症状:**
500テストの実行に1分以上かかる

**解決策:**

1. **並列実行を有効化:**
```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 8,
      },
    },
  },
});
```

2. **不要なグローバル設定を削除:**
```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    globals: false, // グローバル変数を無効化（高速化）
  },
});
```

3. **テストの分離を無効化:**
```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    isolate: false, // 高速化（テスト間の干渉に注意）
  },
});
```

### Playwrightの実行が遅い

**症状:**
50テストの実行に20分以上かかる

**解決策:**

1. **並列実行数を増やす:**
```typescript title="playwright.config.ts"
export default defineConfig({
  workers: 8, // CPUコア数に応じて調整
});
```

2. **不要なブラウザを削除:**
```typescript title="playwright.config.ts"
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // firefox, webkit は削除
  ],
});
```

3. **トレースを無効化:**
```typescript title="playwright.config.ts"
export default defineConfig({
  use: {
    trace: 'off', // 高速化
    video: 'off',
    screenshot: 'off',
  },
});
```

### Storybookのビルドが遅い

**症状:**
Storybookビルドに10分以上かかる

**解決策:**

1. **キャッシュ削除:**
```bash
rm -rf node_modules/.cache
pnpm build-storybook
```

2. **不要なアドオン削除:**
```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials',
    // 不要なアドオンを削除
  ],
};
```

---

## よくあるエラーメッセージ

### `ReferenceError: document is not defined`

**原因:** jsdom環境が設定されていない

**解決策:**
```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

### `TypeError: Cannot read property 'pathname' of undefined`

**原因:** Next.js Routerがモックされていない

**解決策:**
```typescript title="src/tests/setup.ts"
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
```

### `Error: Uncaught [Error: Not implemented: HTMLFormElement.prototype.submit]`

**原因:** jsdomがsubmitをサポートしていない

**解決策:**
```typescript
// ✅ GOOD: userEvent使用
await userEvent.click(screen.getByRole('button', { name: '送信' }));

// ❌ BAD: form.submit()直接呼び出し
form.submit();
```

### `TimeoutError: page.goto: Timeout 30000ms exceeded`

**原因:** ページ読み込みがタイムアウト

**解決策:**
```typescript
// タイムアウト延長
await page.goto('/', { timeout: 60000 });

// または待機なし
await page.goto('/', { waitUntil: 'domcontentloaded' });
```

### `Error: Headers is not defined`

**原因:** Node.js環境でFetch APIが利用できない

**解決策:**
```bash
# Node.js 18以上（推奨: 20以上）を使用
node --version

# または polyfill追加
pnpm add -D whatwg-fetch
```

```typescript title="src/tests/setup.ts"
import 'whatwg-fetch';
```

---

## デバッグのヒント

### Vitestのデバッグ

```bash
# UI Modeで実行
pnpm test:ui

# 特定のテストのみ実行
pnpm test Button.test.tsx

# Watchモードで実行
pnpm test --watch

# デバッグログ表示
DEBUG=* pnpm test
```

### Playwrightのデバッグ

```bash
# UI Modeで実行（推奨）
pnpm test:e2e:ui

# デバッグモード
pnpm test:e2e:debug

# ヘッドフルモード（ブラウザ表示）
pnpm test:e2e:headed

# トレース表示
pnpm exec playwright show-trace trace.zip
```

### Storybookのデバッグ

```bash
# 詳細ログ表示（Vite builder前提）
DEBUG=storybook:* pnpm storybook

# キャッシュクリア
rm -rf node_modules/.cache
pnpm storybook

# ビルドエラーの詳細表示
pnpm build-storybook --loglevel verbose
```

---

## ヘルプが必要な場合

### 1. ログの収集

```bash
# Vitest
pnpm test 2>&1 | tee test-output.log

# Playwright
pnpm test:e2e 2>&1 | tee e2e-output.log

# Storybook
pnpm storybook 2>&1 | tee storybook-output.log
```

### 2. 環境情報の収集

```bash
# バージョン情報
node --version
pnpm --version
pnpm exec vitest --version
pnpm exec playwright --version

# 依存関係一覧
pnpm list --depth=0
```

### 3. 最小再現コード

問題を報告する際は、最小限のコードで再現できるようにしてください。

```typescript
// 最小再現例
import { test, expect } from 'vitest';

test('minimal reproduction', () => {
  // 問題が発生する最小限のコード
});
```

---

## まとめ

このガイドでは、テスト自動化で発生する一般的な問題と解決策を説明しました。

### 問題解決のフロー

1. **エラーメッセージを確認**
2. **このガイドで該当する問題を検索**
3. **解決策を試す**
4. **それでも解決しない場合は最小再現コードを作成**
5. **チームに相談またはIssue報告**

### さらなるサポート

- [FAQ](./faq.md) - よくある質問
- [Vitest詳細ガイド](./vitest-guide.md)
- [Playwright詳細ガイド](./playwright-guide.md)
- [Storybook詳細ガイド](./storybook-guide.md)
- [MSW詳細ガイド](./msw-guide.md)

---

**問題が解決しない場合は、チームのSlackチャンネルや週次ミーティングで相談してください。**
