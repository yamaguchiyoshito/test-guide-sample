# FAQ（よくある質問）

## 目次

1. [一般的な質問](#一般的な質問)
2. [Vitest関連](#vitest関連)
3. [Playwright関連](#playwright関連)
4. [Storybook関連](#storybook関連)
5. [MSW関連](#msw関連)
6. [Factory関連](#factory関連)
7. [ベストプラクティス](#ベストプラクティス)
8. [運用・メンテナンス](#運用メンテナンス)

---

## 一般的な質問

### Q: テスト自動化は必須ですか？

**A:** プロジェクトの規模と性質によります。

- **必須のケース:**
  - 複数人で開発するプロジェクト
  - 長期運用が予定されているプロジェクト
  - 頻繁にリリースするプロジェクト
  - Critical な機能を持つプロジェクト

- **任意のケース:**
  - 短期間のプロトタイプ
  - 個人開発の小規模プロジェクト
  - 一度作って終わりのプロジェクト

本プロジェクトでは、品質保証とメンテナンス性向上のため、テスト自動化を推奨しています。

### Q: どのテストから書き始めるべきですか？

**A:** 以下の順序を推奨します：

1. **Pure Functions（ユーティリティ関数）** - 最も簡単
2. **React Components（単体）** - MSW不要な単純なコンポーネント
3. **React Components（API統合）** - MSW使用
4. **Critical Path E2E** - 最重要ユーザーフロー5-10本

まずは小さく始めて、徐々に範囲を広げることが成功の鍵です。

### Q: カバレッジ目標は何%が適切ですか？

**A:** 一般的な目標値：

- **80%以上** - 推奨（本プロジェクトの目標）
- **70-80%** - 許容範囲
- **70%未満** - 改善が必要

ただし、カバレッジは品質の指標の一つに過ぎません。**Critical Path がテストされていること**の方が重要です。

### Q: テストコードと本番コードの割合は？

**A:** 一般的な比率：

- **テストコード : 本番コード = 1:2 〜 1:3**

例：
- 本番コード 10,000行 → テストコード 3,000-5,000行

ただし、複雑なビジネスロジックが多い場合は 1:1 になることもあります。

### Q: テストの実行時間はどのくらいが適切ですか？

**A:** 目安：

| テスト種別 | 実行時間 | 備考 |
|----------|---------|------|
| **Vitest（Unit）** | < 30秒 | 500-1000テスト |
| **Storybook Interaction** | < 2分 | 100-200 Stories |
| **Playwright E2E** | < 10分 | 50-100テスト（並列実行） |
| **合計** | < 15分 | CI/CD全体 |

10分を超える場合は並列実行やシャーディングを検討してください。

---

## Vitest関連

### Q: JestからVitestに移行するメリットは？

**A:** 主なメリット：

1. **高速** - Viteベースで起動・実行が速い
2. **ESM対応** - 追加設定不要
3. **TypeScript対応** - ts-jest不要
4. **設定共通化** - Viteの設定を再利用
5. **Watch Mode高速** - HMR活用

本プロジェクトではNext.js（Vite未使用）でもVitestを採用しています。

### Q: Vitestでモックするタイミングは？

**A:** モックの判断基準：

```typescript
// ✅ モック推奨
// - 外部API呼び出し（MSW使用）
// - Next.js Router（vi.mock使用）
// - 環境依存の関数（Date, Math.random等）
// - 重い計算処理

// ❌ モック不要
// - Pure Functions
// - React Components（実際にレンダリング）
// - 内部ロジック
```

**原則:** 実際の実装をテストする方が、モックよりも価値が高いです。

### Q: `describe` と `test` の使い分けは？

**A:**

```typescript
// ✅ GOOD: 論理的にグループ化
describe('UserCard', () => {
  describe('表示', () => {
    test('ユーザー名を表示する', () => {});
    test('メールアドレスを表示する', () => {});
  });

  describe('インタラクション', () => {
    test('削除ボタンクリックで削除処理が呼ばれる', () => {});
  });
});

// ⚠️ OK: フラットな構造（シンプルなケース）
test('displays user name', () => {});
test('displays email', () => {});
test('calls onDelete when clicked', () => {});
```

関連するテストをグループ化すると、レポートが読みやすくなります。

### Q: `beforeEach` と `afterEach` の使い分けは？

**A:**

```typescript
// beforeEach: 各テスト前の準備
beforeEach(() => {
  // テストデータ生成
  // モックリセット
  // 初期状態設定
});

// afterEach: 各テスト後のクリーンアップ
afterEach(() => {
  // DOMクリーンアップ（cleanup()）
  // MSWハンドラーリセット
  // モッククリア
});

// beforeAll/afterAll: 全テスト前後の一度だけ
beforeAll(() => {
  // MSWサーバー起動
  // データベース接続
});

afterAll(() => {
  // MSWサーバー停止
  // データベース切断
});
```

### Q: `expect` のマッチャーはどれを使うべき？

**A:** 状況に応じて使い分け：

```typescript
// 厳密な等価性（プリミティブ）
expect(value).toBe(42);
expect(value).toBe('hello');

// 深い等価性（オブジェクト・配列）
expect(object).toEqual({ name: 'Alice' });
expect(array).toEqual([1, 2, 3]);

// 部分一致（オブジェクト）
expect(object).toMatchObject({ name: 'Alice' });
// { name: 'Alice', age: 25 } も合格

// 配列の要素
expect(array).toContain(item);
expect(array).toContainEqual({ id: 1 });

// 真偽値
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// 存在確認（DOM）
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
```

---

## Playwright関連

### Q: PlaywrightとCypressの違いは？

**A:** 主な違い：

| 項目 | Playwright | Cypress |
|-----|-----------|---------|
| **複数ブラウザ** | ✅ Chrome/Firefox/Safari | ⚠️ Chrome/Firefox（Safariは限定的） |
| **並列実行** | ✅ 標準サポート | ⚠️ 有料プラン |
| **自動待機** | ✅ 強力 | ✅ 強力 |
| **デバッグ** | ✅ UI Mode/Trace | ✅ Time Travel |
| **学習曲線** | 中程度 | 易しい |

本プロジェクトでは、複数ブラウザ対応と並列実行を重視してPlaywrightを採用しています。

### Q: E2Eテストは何本書けばいいですか？

**A:** 推奨：

- **Critical Paths: 5-10本**
  - ユーザー登録
  - ログイン/ログアウト
  - 主要な購入・決済フロー
  - データ作成・更新・削除

- **補助的なフロー: 10-20本**
  - エラーハンドリング
  - バリデーション
  - ページ遷移

**重要:** すべてをE2Eでテストしません。細かいケースはUnit/Component Testで対応します。

### Q: Page Object Modelは必須ですか？

**A:** プロジェクトの規模によります：

```typescript
// ✅ 推奨: Page Object Model（保守性高）
const loginPage = new LoginPage(page);
await loginPage.login('user@example.com', 'password');

// ⚠️ OK: 直接記述（小規模・単純なケース）
await page.goto('/login');
await page.getByLabel('メールアドレス').fill('user@example.com');
await page.getByLabel('パスワード').fill('password');
await page.getByRole('button', { name: 'ログイン' }).click();
```

**判断基準:**
- E2Eテストが10本以上 → Page Object Model推奨
- 同じページを複数テストで使用 → Page Object Model推奨
- テストが5本以下 → 直接記述でもOK

### Q: data-testid を使うべきですか？

**A:** 最終手段として使用：

```typescript
// 優先順位
// 1. ロール（最優先）
await page.getByRole('button', { name: '送信' });

// 2. Label
await page.getByLabel('メールアドレス');

// 3. Text
await page.getByText('ようこそ');

// 4. data-testid（最終手段）
await page.getByTestId('complex-component');
```

**data-testid を使うケース:**
- セマンティックなセレクターが使えない
- 動的なテキストで特定できない
- 複雑なコンポーネントの特定要素

### Q: Playwrightのリトライ設定はどうすべき？

**A:**

```typescript title="playwright.config.ts"
export default defineConfig({
  // CI環境のみリトライ
  retries: process.env.CI ? 2 : 0,
});
```

**理由:**
- ローカル: リトライなし（問題を即座に発見）
- CI: 2回リトライ（ネットワーク等の一時的な問題を吸収）

---

## Storybook関連

### Q: StorybookとPlaywrightの使い分けは？

**A:**

| 用途 | Storybook | Playwright |
|-----|-----------|-----------|
| **コンポーネント開発** | ✅ 最適 | ❌ 不向き |
| **UIカタログ** | ✅ 最適 | ❌ 不向き |
| **ビジュアルチェック** | ✅ 適している | ✅ 適している |
| **インタラクション** | ✅ 基本的な操作 | ✅ 複雑なフロー |
| **E2Eテスト** | ❌ 不可能 | ✅ 最適 |

**使い分けの原則:**
- Storybook: コンポーネント単体・ページ単体
- Playwright: 複数ページにまたがるフロー

### Q: すべてのコンポーネントにStoriesが必要ですか？

**A:** いいえ、優先順位をつけてください：

```
✅ 必須
- 再利用可能なUIコンポーネント（Button, Input等）
- デザインシステムのコンポーネント
- 複雑な状態を持つコンポーネント

⚠️ 推奨
- ページコンポーネント
- 主要なビジネスロジックを持つコンポーネント

❌ 不要
- 単純なラッパーコンポーネント
- レイアウトのみのコンポーネント
- プライベートな内部コンポーネント
```

### Q: StorybookでAPIを実際に呼び出せますか？

**A:** 技術的には可能ですが、**非推奨**です：

```typescript
// ❌ BAD: 実際のAPIを呼び出し
export const Default: Story = {
  name: 'デフォルト（非推奨）',
  // APIを実際に呼び出す（非推奨）
};

// ✅ GOOD: MSWでモック
export const Default: Story = {
  name: 'デフォルト',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json(userFactory.buildList(10));
        }),
      ],
    },
  },
};
```

**理由:**
- APIサーバーへの依存が生まれる
- 開発環境とStorybookの分離が崩れる
- データが不安定になる

### Q: Interaction Testsは必要ですか？

**A:** 主要なユーザーフローには推奨：

```typescript
// ✅ 推奨: 重要な操作
export const LoginFlow: Story = {
  name: 'ログインフロー',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabel('メールアドレス'), 'test@example.com');
    await userEvent.type(canvas.getByLabel('パスワード'), 'password');
    await userEvent.click(canvas.getByRole('button', { name: 'ログイン' }));
    await expect(canvas.getByText('成功')).toBeInTheDocument();
  },
};

// ❌ 不要: 静的な表示のみ
export const Static: Story = {
  name: '静的表示',
  args: { title: 'タイトル' },
  // play不要
};
```

---

## MSW関連

### Q: MSWは本番環境で有効化すべきですか？

**A:** **絶対にNO**です：

```typescript title="src/app/providers.tsx"
export function Providers({ children }) {
  useEffect(() => {
    // ✅ GOOD: 開発環境のみ
    if (process.env.NODE_ENV === 'development') {
      import('@/tests/msw/browser').then(({ worker }) => {
        worker.start();
      });
    }
  }, []);

  return <>{children}</>;
}
```

**理由:**
- パフォーマンス低下
- セキュリティリスク
- 実際のAPIが呼ばれない

### Q: MSWハンドラーはどこまで詳細に書くべき？

**A:** テストに必要な範囲で十分：

```typescript
// ✅ GOOD: シンプル
http.get('/api/users/:id', ({ params }) => {
  return HttpResponse.json(userFactory.build({ id: params.id }));
});

// ❌ 過剰: 実際のバックエンドロジックを再現
http.get('/api/users/:id', async ({ params, request }) => {
  // データベースクエリの再現
  // 権限チェックの再現
  // 複雑なビジネスロジックの再現
  // ← 不要
});
```

**原則:** MSWは「APIが正しく呼ばれること」「レスポンスが正しく処理されること」をテストするためのものです。バックエンドロジックのテストではありません。

### Q: MSWとPlaywrightを併用できますか？

**A:** できますが、**基本的には不要**：

```typescript
// ⚠️ できるが通常は不要
test('with MSW', async ({ page, context }) => {
  // PlaywrightでもMSWを使える
  await context.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify([]),
    });
  });
});

// ✅ 推奨: 実際のAPIをテスト
test('with real API', async ({ page }) => {
  await page.goto('/users');
  // 実際のAPIを呼び出す
});
```

**MSWを使うケース（例外的）:**
- 外部サービスAPIのモック（決済、メール送信等）
- エラーケースのシミュレーション

### Q: MSWでファイルアップロードをテストできますか？

**A:** できます：

```typescript
http.post('/api/upload', async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  return HttpResponse.json({
    filename: file.name,
    size: file.size,
    type: file.type,
  });
});
```

---

## Factory関連

### Q: FactoryとMockの違いは？

**A:**

| 項目 | Factory | Mock |
|-----|---------|------|
| **目的** | テストデータ生成 | 関数・モジュールの振る舞い制御 |
| **対象** | データオブジェクト | 関数・クラス・モジュール |
| **使用例** | `userFactory.build()` | `vi.fn()`, `vi.mock()` |

```typescript
// Factory: データ生成
const user = userFactory.build({ name: 'Alice' });

// Mock: 関数の振る舞い制御
const mockFn = vi.fn().mockReturnValue(42);
```

### Q: Factoryで日付を固定するには？

**A:**

```typescript
// 方法1: 固定日付を使用
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    createdAt: '2024-01-01T00:00:00Z', // 固定
    ...overrides,
  }),
};

// 方法2: fakerで生成（Seed固定前提）
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    createdAt: faker.date.past().toISOString(), // Seed固定で決定的
    ...overrides,
  }),
};

// 方法3: テストで時刻をモック
beforeEach(() => {
  vi.setSystemTime(new Date('2024-01-01'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

### Q: Factoryのテストは必要ですか？

**A:** 推奨します：

```typescript title="src/tests/factories/userFactory.test.ts"
import { userFactory } from './userFactory';
import { UserSchema } from '@/api/schemas/userSchema';

describe('userFactory', () => {
  test('generates valid user', () => {
    const user = userFactory.build();
    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  test('overrides work', () => {
    const user = userFactory.build({ name: 'Alice' });
    expect(user.name).toBe('Alice');
  });
});
```

**理由:**
- zodスキーマとの整合性確認
- Factory自体のバグ検出
- リファクタリング時の安全性

### Q: 複数のFactoryで同じデータを使いたい

**A:** 共通のヘルパーを作成：

```typescript title="src/tests/factories/helpers/common.ts"
import { faker } from './faker';

export const commonDefaults = {
  createdAt: () => faker.date.past().toISOString(),
  updatedAt: () => new Date().toISOString(),
  id: () => faker.string.uuid(),
};
```

```typescript title="src/tests/factories/userFactory.ts"
import { commonDefaults } from './helpers/common';

export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: commonDefaults.id(),
    name: faker.person.fullName(),
    createdAt: commonDefaults.createdAt(),
    updatedAt: commonDefaults.updatedAt(),
    ...overrides,
  }),
};
```

---

## ベストプラクティス

### Q: テストファーストで開発すべきですか（TDD）？

**A:** チームの経験と状況によります：

**TDD推奨のケース:**
- 要件が明確
- ビジネスロジックが複雑
- チームがTDDに慣れている

**実装ファースト推奨のケース:**
- 要件が不明確（プロトタイプ段階）
- UIデザインが流動的
- チームがTDD未経験

本プロジェクトでは、**実装後にテストを書く**スタイルを基本としています。

### Q: テストコードのコメントは必要ですか？

**A:** 最小限に：

```typescript
// ✅ GOOD: テスト名で意図が明確
test('未入力の状態では送信ボタンが無効になる', () => {
  render(<Form />);
  const button = screen.getByRole('button', { name: '送信' });
  expect(button).toBeDisabled();
});

// ❌ BAD: 不要なコメント
test('button disabled', () => {
  // フォームをレンダリング
  render(<Form />);
  // 送信ボタンを取得
  const button = screen.getByRole('button', { name: '送信' });
  // ボタンが無効であることを確認
  expect(button).toBeDisabled();
});

// ✅ GOOD: 複雑なロジックのみコメント
test('複雑な計算処理が正しい', () => {
  // 特殊なケース: 閏年の2月29日の処理
  const result = calculateDate('2024-02-29');
  expect(result).toBe('2024-03-01');
});
```

### Q: テストのリファクタリングはいつやるべき？

**A:** 以下のタイミング：

1. **重複コードが3回以上現れた**
```typescript
// リファクタリング前
test('test1', () => {
  const user = userFactory.build();
  server.use(getUserHandler);
  render(<UserCard userId={user.id} />);
});

test('test2', () => {
  const user = userFactory.build();
  server.use(getUserHandler);
  render(<UserCard userId={user.id} />);
});

// リファクタリング後
function setupUserCard(userId: string) {
  server.use(getUserHandler);
  render(<UserCard userId={userId} />);
}

test('test1', () => {
  const user = userFactory.build();
  setupUserCard(user.id);
});
```

2. **テストが読みにくくなった**（100行超）

3. **メンテナンスコストが高い**（1箇所の変更で10個のテストが壊れる）

### Q: Flaky Testsを防ぐには？

**A:** 以下を徹底：

```typescript
// ✅ DO
// - 明示的な待機（waitFor, waitForResponse）
// - Seed固定（faker.seed()）
// - 決定的なデータ生成
// - テストの独立性（各テストで状態リセット）
// - 自動リトライ（Playwrightのみ、CI環境）

// ❌ DON'T
// - 固定待機時間（waitForTimeout）
// - Math.random()、new Date()
// - テスト間の状態共有
// - グローバル変数の使用
```

---

## 運用・メンテナンス

### Q: テストが壊れたらどうすればいいですか？

**A:** 以下の手順で対応：

1. **エラーメッセージを確認**
2. **トラブルシューティングガイドを参照**
3. **ローカルで再現**
4. **該当箇所を修正**
5. **テストが通ることを確認**
6. **コミット・プッシュ**

```bash
# ローカルで再現
pnpm test UserCard.test.tsx

# 修正後確認
pnpm test UserCard.test.tsx
pnpm test:e2e login.spec.ts

# 全体確認
pnpm test
pnpm test:e2e
```

### Q: 新しいメンバーへのオンボーディングは？

**A:** 段階的に学習：

**Week 1: 基礎**
- [Getting Started](./getting-started.md) を読む
- Vitest基本（Pure Functions）
- Factory基本

**Week 2: 実践**
- Component Test作成
- Storybook Stories作成
- MSW Handlers作成

**Week 3: 応用**
- Playwright E2E作成
- Interaction Tests作成
- 既存テストのレビュー参加

**Week 4: 自立**
- 新機能のテスト完全実装
- コードレビュー実施

### Q: テストのメンテナンスコストを下げるには？

**A:**

1. **Page Object Modelを使う**（Playwright）
2. **Factoryを活用する**（重複排除）
3. **共通ヘルパーを作る**
4. **ドキュメントを整備する**
5. **定期的にリファクタリングする**

```typescript
// ✅ GOOD: メンテナンスしやすい
const user = userFactory.buildAdmin();
const loginPage = new LoginPage(page);
await loginPage.login(user.email, 'password');

// ❌ BAD: メンテナンスしにくい
const user = {
  id: '1',
  email: 'admin@example.com',
  // ... 20行のデータ
};
await page.goto('/login');
await page.getByLabel('メール').fill(user.email);
// ... 10行の操作
```

### Q: テストコードのレビューのポイントは？

**A:** 以下を確認：

- [ ] テスト名が明確
- [ ] AAAパターンに従っている
- [ ] テストの独立性がある
- [ ] 適切なアサーションを使用
- [ ] 重複コードがない
- [ ] 決定的なデータ生成
- [ ] 固定待機時間を使っていない
- [ ] カバレッジが十分

### Q: CI/CDの実行時間を短縮するには？

**A:**

1. **並列実行**
```yaml
test:unit:
  parallel: 4
test:e2e:
  parallel: 4
```

2. **キャッシュ活用**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .next/cache/
```

3. **不要なテスト削除**
```typescript
// 重複・不要なテストを削除
test.skip('古いテスト', () => {});
```

4. **最適化**
```typescript
// Vitestの並列実行
test: {
  pool: 'threads',
  poolOptions: {
    threads: { maxThreads: 8 }
  }
}
```

---

## さらに詳しく知りたい場合

### ドキュメント

- [Getting Started](./getting-started.md) - 全体像
- [Vitest詳細ガイド](./vitest-guide.md)
- [Playwright詳細ガイド](./playwright-guide.md)
- [Storybook詳細ガイド](./storybook-guide.md)
- [MSW詳細ガイド](./msw-guide.md)
- [Factory Pattern詳細ガイド](./factory-pattern.md)
- [トラブルシューティング](./troubleshooting.md)

### コミュニティ

- **Slack チャンネル:** #test-automation
- **週次ミーティング:** 毎週金曜 15:00-15:30
- **Office Hours:** 毎週水曜 14:00-15:00

### 外部リソース

- [Vitest公式ドキュメント](https://vitest.dev/)
- [Playwright公式ドキュメント](https://playwright.dev/)
- [Storybook公式ドキュメント](https://storybook.js.org/)
- [MSW公式ドキュメント](https://mswjs.io/)
- [Testing Library公式ドキュメント](https://testing-library.com/)

---

**このFAQは定期的に更新されます。新しい質問や改善提案がある場合は、チームに共有してください。**
