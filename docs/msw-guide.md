# MSW 詳細ガイド

## 目次

1. [MSWとは](#mswとは)
2. [環境構築](#環境構築)
3. [ハンドラーの基本](#ハンドラーの基本)
4. [レスポンスのバリエーション](#レスポンスのバリエーション)
5. [リクエストの検証](#リクエストの検証)
6. [エラーシミュレーション](#エラーシミュレーション)
7. [遅延とタイムアウト](#遅延とタイムアウト)
8. [動的なレスポンス生成](#動的なレスポンス生成)
9. [ハンドラーの組織化](#ハンドラーの組織化)
10. [デバッグとログ](#デバッグとログ)
11. [ベストプラクティス](#ベストプラクティス)

---

## MSWとは

MSW（Mock Service Worker）は、Service WorkerまたはNode.jsのネットワークレベルでHTTPリクエストをインターセプトし、モックレスポンスを返すライブラリです。

### なぜMSWを使うのか

| 従来のモック手法 | MSW |
|---------------|-----|
| axios/fetchを直接モック | 実際のネットワークリクエストをインターセプト |
| テストコードに依存 | ブラウザ/Node両方で動作 |
| 各テストでモック設定 | 一度設定すれば全体で共有 |
| 実装詳細に依存 | APIインターフェースに依存 |

### MSWの動作原理

```
┌─────────────┐
│   React     │
│  Component  │
└──────┬──────┘
       │ fetch('/api/users')
       ▼
┌─────────────┐
│  MSW        │ ← リクエストをインターセプト
│  Handler    │
└──────┬──────┘
       │ HttpResponse.json(mockData)
       ▼
┌─────────────┐
│   React     │ ← モックレスポンスを受け取る
│  Component  │
└─────────────┘
```

### プロジェクトでの使用場所

```
Vitest Tests        ← MSW (Node.js)
Storybook          ← MSW (Browser)
Playwright E2E     ← 実際のAPI（または必要に応じてMSW）
```

---

## 環境構築

### 依存関係のインストール

```bash
# MSWインストール
pnpm add -D msw@latest

# Storybook統合
pnpm add -D msw-storybook-addon
```

### ブラウザ用Service Worker生成

```bash
# publicディレクトリにService Workerファイルを生成
pnpm exec msw init public/ --save
```

これにより `public/mockServiceWorker.js` が生成されます。

### ディレクトリ構造

```bash
src/
├── tests/
│   ├── msw/
│   │   ├── server.ts              # Node.js用（Vitest）
│   │   ├── browser.ts             # Browser用（開発環境）
│   │   └── handlers/              # APIハンドラー
│   │       ├── index.ts           # ハンドラー統合
│   │       ├── authHandlers.ts    # 認証API
│   │       ├── userHandlers.ts    # ユーザーAPI
│   │       └── orderHandlers.ts   # 注文API
│   └── factories/                 # テストデータFactory
│       ├── userFactory.ts
│       └── orderFactory.ts
```

### Node.js用サーバー設定

```typescript title="src/tests/msw/server.ts"
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node.js環境用MSWサーバー（Vitest用）
export const server = setupServer(...handlers);
```

### ブラウザ用ワーカー設定

```typescript title="src/tests/msw/browser.ts"
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// ブラウザ環境用MSWワーカー（開発環境用）
export const worker = setupWorker(...handlers);
```

### 開発環境での有効化（オプション）

```typescript title="src/app/providers.tsx"
'use client';

import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // 開発環境でMSWを起動（オプション）
      import('@/tests/msw/browser').then(({ worker }) => {
        worker.start({
          onUnhandledRequest: 'bypass', // 未定義リクエストは通過
        });
      });
    }
  }, []);

  return <>{children}</>;
}
```

### Vitestセットアップ

```typescript title="src/tests/setup.ts"
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';

// MSWサーバー起動
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error', // 未定義リクエストでエラー
  });
});

// 各テスト後にハンドラーリセット
afterEach(() => {
  server.resetHandlers();
});

// MSWサーバー停止
afterAll(() => {
  server.close();
});
```

### Storybookセットアップ

```typescript title=".storybook/preview.tsx"
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/tests/msw/handlers';

// MSW初期化
initialize({
  onUnhandledRequest: 'warn',
});

const preview: Preview = {
  parameters: {
    msw: {
      handlers: handlers, // デフォルトハンドラー
    },
  },
  loaders: [mswLoader], // MSWローダー
};

export default preview;
```

---

## ハンドラーの基本

### 基本的なGETハンドラー

```typescript title="src/tests/msw/handlers/userHandlers.ts"
import { http, HttpResponse } from 'msw';
import { userFactory } from '@/tests/factories/userFactory';

export const userHandlers = [
  // GET /api/users - ユーザー一覧取得
  http.get('/api/users', () => {
    const users = userFactory.buildList(10);
    return HttpResponse.json(users);
  }),

  // GET /api/users/:id - 特定ユーザー取得
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    const user = userFactory.build({ id: id as string });
    return HttpResponse.json(user);
  }),
];
```

### POSTハンドラー

```typescript
export const userHandlers = [
  // POST /api/users - ユーザー作成
  http.post('/api/users', async ({ request }) => {
    // リクエストボディを取得
    const body = await request.json();

    // レスポンス生成
    const newUser = userFactory.build({
      name: body.name,
      email: body.email,
    });

    return HttpResponse.json(newUser, { status: 201 });
  }),
];
```

### PUT/PATCHハンドラー

```typescript
export const userHandlers = [
  // PUT /api/users/:id - ユーザー更新
  http.put('/api/users/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();

    const updatedUser = userFactory.build({
      id: id as string,
      ...body,
    });

    return HttpResponse.json(updatedUser);
  }),

  // PATCH /api/users/:id - ユーザー部分更新
  http.patch('/api/users/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();

    // 既存データを取得（実際にはFactoryで生成）
    const existingUser = userFactory.build({ id: id as string });

    // 部分更新
    const updatedUser = {
      ...existingUser,
      ...body,
    };

    return HttpResponse.json(updatedUser);
  }),
];
```

### DELETEハンドラー

```typescript
export const userHandlers = [
  // DELETE /api/users/:id - ユーザー削除
  http.delete('/api/users/:id', ({ params }) => {
    const { id } = params;

    // 204 No Content
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### クエリパラメーター処理

```typescript
export const userHandlers = [
  // GET /api/users?page=1&limit=10&search=alice
  http.get('/api/users', ({ request }) => {
    const url = new URL(request.url);

    // クエリパラメーター取得
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';

    // データ生成
    let users = userFactory.buildList(100);

    // 検索フィルター
    if (search) {
      users = users.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // ページネーション
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedUsers = users.slice(start, end);

    return HttpResponse.json({
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total: users.length,
        totalPages: Math.ceil(users.length / limit),
      },
    });
  }),
];
```

---

## レスポンスのバリエーション

### JSONレスポンス

```typescript
// 基本的なJSON
http.get('/api/users', () => {
  return HttpResponse.json({ message: 'Success' });
});

// ステータスコード指定
http.post('/api/users', () => {
  return HttpResponse.json(
    { id: '123', name: 'Alice' },
    { status: 201 }
  );
});

// カスタムヘッダー
http.get('/api/users', () => {
  return HttpResponse.json(
    { data: [] },
    {
      status: 200,
      headers: {
        'X-Total-Count': '100',
        'Content-Type': 'application/json',
      },
    }
  );
});
```

### テキストレスポンス

```typescript
http.get('/api/health', () => {
  return HttpResponse.text('OK');
});

http.get('/api/version', () => {
  return HttpResponse.text('1.0.0', {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
});
```

### XMLレスポンス

```typescript
http.get('/api/feed', () => {
  const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>My Feed</title>
      </channel>
    </rss>
  `;

  return HttpResponse.text(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
});
```

### バイナリレスポンス

```typescript
http.get('/api/files/:id', async () => {
  // ファイルを読み込んでArrayBufferとして返す
  const file = await fetch('/sample.pdf').then(r => r.arrayBuffer());

  return HttpResponse.arrayBuffer(file, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="sample.pdf"',
    },
  });
});
```

### リダイレクト

```typescript
http.get('/api/old-endpoint', () => {
  return HttpResponse.redirect('/api/new-endpoint', 301);
});
```

---

## リクエストの検証

### リクエストヘッダーの検証

```typescript
http.post('/api/users', async ({ request }) => {
  // Authorizationヘッダー確認
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      { message: '認証が必要です' },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');

  // トークン検証（簡易）
  if (token !== 'valid-token') {
    return HttpResponse.json(
      { message: 'トークンが無効です' },
      { status: 403 }
    );
  }

  // 正常レスポンス
  const newUser = userFactory.build();
  return HttpResponse.json(newUser, { status: 201 });
});
```

### リクエストボディの検証

```typescript
http.post('/api/users', async ({ request }) => {
  const body = await request.json();

  // バリデーション
  if (!body.name || body.name.length < 1) {
    return HttpResponse.json(
      {
        message: 'バリデーションエラー',
        errors: {
          name: ['名前は必須です'],
        },
      },
      { status: 400 }
    );
  }

  if (!body.email || !body.email.includes('@')) {
    return HttpResponse.json(
      {
        message: 'バリデーションエラー',
        errors: {
          email: ['有効なメールアドレスを入力してください'],
        },
      },
      { status: 400 }
    );
  }

  // 正常レスポンス
  const newUser = userFactory.build({
    name: body.name,
    email: body.email,
  });

  return HttpResponse.json(newUser, { status: 201 });
});
```

### zodスキーマによる検証

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  age: z.number().min(0).max(150).optional(),
});

http.post('/api/users', async ({ request }) => {
  const body = await request.json();

  // zodでバリデーション
  const result = CreateUserSchema.safeParse(body);

  if (!result.success) {
    return HttpResponse.json(
      {
        message: 'バリデーションエラー',
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // 正常レスポンス
  const newUser = userFactory.build(result.data);
  return HttpResponse.json(newUser, { status: 201 });
});
```

---

## エラーシミュレーション

### 4xx クライアントエラー

```typescript
export const errorHandlers = [
  // 400 Bad Request
  http.post('/api/users', () => {
    return HttpResponse.json(
      {
        message: 'リクエストが不正です',
        errors: {
          email: ['メールアドレスの形式が正しくありません'],
        },
      },
      { status: 400 }
    );
  }),

  // 401 Unauthorized
  http.get('/api/profile', () => {
    return HttpResponse.json(
      { message: '認証が必要です' },
      { status: 401 }
    );
  }),

  // 403 Forbidden
  http.delete('/api/users/:id', () => {
    return HttpResponse.json(
      { message: 'この操作を実行する権限がありません' },
      { status: 403 }
    );
  }),

  // 404 Not Found
  http.get('/api/users/:id', () => {
    return HttpResponse.json(
      { message: 'ユーザーが見つかりません' },
      { status: 404 }
    );
  }),

  // 422 Unprocessable Entity
  http.post('/api/users', () => {
    return HttpResponse.json(
      {
        message: 'バリデーションエラー',
        errors: {
          email: ['このメールアドレスは既に使用されています'],
        },
      },
      { status: 422 }
    );
  }),
];
```

### 5xx サーバーエラー

```typescript
export const errorHandlers = [
  // 500 Internal Server Error
  http.get('/api/users', () => {
    return HttpResponse.json(
      { message: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }),

  // 502 Bad Gateway
  http.get('/api/external', () => {
    return HttpResponse.json(
      { message: '外部サービスとの通信に失敗しました' },
      { status: 502 }
    );
  }),

  // 503 Service Unavailable
  http.get('/api/users', () => {
    return HttpResponse.json(
      { message: 'サービスが一時的に利用できません' },
      { status: 503 }
    );
  }),
];
```

### ネットワークエラー

```typescript
import { HttpResponse } from 'msw';

// ネットワークエラーをシミュレート
http.get('/api/users', () => {
  return HttpResponse.error();
});
```

### ランダムエラー（Flaky Test対策）

```typescript
// 30%の確率でエラーを返す
http.get('/api/users', () => {
  if (Math.random() < 0.3) {
    return HttpResponse.json(
      { message: 'サーバーエラー' },
      { status: 500 }
    );
  }

  const users = userFactory.buildList(10);
  return HttpResponse.json(users);
});
```

---

## 遅延とタイムアウト

### 固定遅延

```typescript
import { delay, http, HttpResponse } from 'msw';

// 1秒遅延
http.get('/api/users', async () => {
  await delay(1000); // 1000ms = 1秒
  const users = userFactory.buildList(10);
  return HttpResponse.json(users);
});
```

### ランダム遅延

```typescript
// 500ms〜2000msのランダム遅延
http.get('/api/users', async () => {
  const randomDelay = Math.floor(Math.random() * 1500) + 500;
  await delay(randomDelay);

  const users = userFactory.buildList(10);
  return HttpResponse.json(users);
});
```

### 無限待機（ローディング状態テスト用）

```typescript
// 無限待機（テスト用）
http.get('/api/users', async () => {
  await delay('infinite');
  return HttpResponse.json([]);
});
```

### Storybook での使用例

```typescript title="src/components/UserList/UserList.stories.tsx"
import { delay, http, HttpResponse } from 'msw';

export const Loading: Story = {
  name: '読み込み中',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', async () => {
          await delay('infinite'); // ローディング状態を維持
          return HttpResponse.json([]);
        }),
      ],
    },
  },
};

export const SlowNetwork: Story = {
  name: '低速ネットワーク',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', async () => {
          await delay(3000); // 3秒遅延
          const users = userFactory.buildList(10);
          return HttpResponse.json(users);
        }),
      ],
    },
  },
};
```

---

## 動的なレスポンス生成

### 状態を持つハンドラー

```typescript
// インメモリデータストア
let users = userFactory.buildList(5);

export const statefulHandlers = [
  // GET - 全ユーザー取得
  http.get('/api/users', () => {
    return HttpResponse.json(users);
  }),

  // POST - ユーザー作成
  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    const newUser = userFactory.build({
      id: `user-${users.length + 1}`,
      ...body,
    });

    users.push(newUser);

    return HttpResponse.json(newUser, { status: 201 });
  }),

  // PUT - ユーザー更新
  http.put('/api/users/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();

    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { message: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    users[index] = { ...users[index], ...body };

    return HttpResponse.json(users[index]);
  }),

  // DELETE - ユーザー削除
  http.delete('/api/users/:id', ({ params }) => {
    const { id } = params;

    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { message: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    users.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
```

### リクエストに応じた動的レスポンス

```typescript
http.get('/api/users/:id', ({ params }) => {
  const { id } = params;

  // IDに応じて異なるデータを返す
  if (id === 'admin') {
    return HttpResponse.json(
      userFactory.buildAdmin({ id: 'admin' })
    );
  }

  if (id === 'guest') {
    return HttpResponse.json(
      userFactory.build({ id: 'guest', role: 'guest' })
    );
  }

  // デフォルト
  return HttpResponse.json(
    userFactory.build({ id: id as string })
  );
});
```

### 条件分岐レスポンス

```typescript
http.post('/api/auth/login', async ({ request }) => {
  const { email, password } = await request.json();

  // 特定の認証情報のみ成功
  if (email === 'admin@example.com' && password === 'admin123') {
    return HttpResponse.json({
      token: 'mock-admin-token',
      user: userFactory.buildAdmin(),
    });
  }

  if (email === 'user@example.com' && password === 'user123') {
    return HttpResponse.json({
      token: 'mock-user-token',
      user: userFactory.build(),
    });
  }

  // それ以外は失敗
  return HttpResponse.json(
    { message: 'メールアドレスまたはパスワードが正しくありません' },
    { status: 401 }
  );
});
```

---

## ハンドラーの組織化

### ドメイン別ハンドラー分割

```typescript title="src/tests/msw/handlers/authHandlers.ts"
import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    // ログイン処理
    return HttpResponse.json({ token: 'mock-token' });
  }),

  http.post('/api/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/auth/refresh', () => {
    return HttpResponse.json({ token: 'new-mock-token' });
  }),
];
```

```typescript title="src/tests/msw/handlers/userHandlers.ts"
import { http, HttpResponse } from 'msw';
import { userFactory } from '@/tests/factories/userFactory';

export const userHandlers = [
  http.get('/api/users', () => {
    const users = userFactory.buildList(10);
    return HttpResponse.json(users);
  }),

  http.get('/api/users/:id', ({ params }) => {
    const user = userFactory.build({ id: params.id as string });
    return HttpResponse.json(user);
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    const newUser = userFactory.build(body);
    return HttpResponse.json(newUser, { status: 201 });
  }),
];
```

```typescript title="src/tests/msw/handlers/orderHandlers.ts"
import { http, HttpResponse } from 'msw';
import { orderFactory } from '@/tests/factories/orderFactory';

export const orderHandlers = [
  http.get('/api/orders', () => {
    const orders = orderFactory.buildList(5);
    return HttpResponse.json(orders);
  }),

  http.get('/api/orders/:id', ({ params }) => {
    const order = orderFactory.build({ id: params.id as string });
    return HttpResponse.json(order);
  }),
];
```

### ハンドラーの統合

```typescript title="src/tests/msw/handlers/index.ts"
import { authHandlers } from './authHandlers';
import { userHandlers } from './userHandlers';
import { orderHandlers } from './orderHandlers';

export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...orderHandlers,
];
```

### シナリオ別ハンドラー

```typescript title="src/tests/msw/scenarios/success.ts"
import { http, HttpResponse } from 'msw';
import { userFactory } from '@/tests/factories/userFactory';

// 成功シナリオ
export const successScenario = [
  http.get('/api/users', () => {
    return HttpResponse.json(userFactory.buildList(10));
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(userFactory.build(body), { status: 201 });
  }),
];
```

```typescript title="src/tests/msw/scenarios/error.ts"
import { http, HttpResponse } from 'msw';

// エラーシナリオ
export const errorScenario = [
  http.get('/api/users', () => {
    return HttpResponse.json(
      { message: 'サーバーエラー' },
      { status: 500 }
    );
  }),

  http.post('/api/users', () => {
    return HttpResponse.json(
      { message: 'バリデーションエラー' },
      { status: 400 }
    );
  }),
];
```

```typescript title="src/tests/msw/scenarios/empty.ts"
import { http, HttpResponse } from 'msw';

// 空データシナリオ
export const emptyScenario = [
  http.get('/api/users', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/orders', () => {
    return HttpResponse.json([]);
  }),
];
```

### テストでのシナリオ切り替え

```typescript title="src/components/UserList/UserList.test.tsx"
import { successScenario } from '@/tests/msw/scenarios/success';
import { errorScenario } from '@/tests/msw/scenarios/error';
import { emptyScenario } from '@/tests/msw/scenarios/empty';

test('正常にユーザー一覧を表示する', async () => {
  server.use(...successScenario);
  render(<UserList />);
  // ...
});

test('エラー時にエラーメッセージを表示する', async () => {
  server.use(...errorScenario);
  render(<UserList />);
  // ...
});

test('空の場合は空メッセージを表示する', async () => {
  server.use(...emptyScenario);
  render(<UserList />);
  // ...
});
```

---

## デバッグとログ

### リクエストログ

```typescript title="src/tests/msw/server.ts"
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// リクエストログ
server.events.on('request:start', ({ request }) => {
  console.log('[MSW] Request:', request.method, request.url);
});

// レスポンスログ
server.events.on('response:mocked', ({ request, response }) => {
  console.log('[MSW] Response:', request.method, request.url, response.status);
});

// 未処理リクエストログ
server.events.on('request:unhandled', ({ request }) => {
  console.warn('[MSW] Unhandled:', request.method, request.url);
});
```

### 開発環境でのデバッグ

```typescript title="src/tests/msw/browser.ts"
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// 開発環境で起動時にログ表示
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'warn',
  });

  worker.events.on('request:start', ({ request }) => {
    console.log(`%c[MSW] ${request.method} ${request.url}`, 'color: blue');
  });
}
```

### ハンドラー内でのログ

```typescript
http.post('/api/users', async ({ request }) => {
  const body = await request.json();

  // デバッグログ
  console.log('[Handler] POST /api/users');
  console.log('[Handler] Body:', body);

  const newUser = userFactory.build(body);

  console.log('[Handler] Response:', newUser);

  return HttpResponse.json(newUser, { status: 201 });
});
```

### 条件付きログ

```typescript
const DEBUG = process.env.DEBUG === 'true';

http.get('/api/users', ({ request }) => {
  if (DEBUG) {
    console.log('[MSW Debug] Request URL:', request.url);
    console.log('[MSW Debug] Headers:', Object.fromEntries(request.headers.entries()));
  }

  const users = userFactory.buildList(10);
  return HttpResponse.json(users);
});
```

---

## ベストプラクティス

### 1. Factoryパターンの活用

```typescript
// ✅ GOOD: Factoryを使用
http.get('/api/users', () => {
  const users = userFactory.buildList(10);
  return HttpResponse.json(users);
});

// ❌ BAD: ハードコード
http.get('/api/users', () => {
  return HttpResponse.json([
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ]);
});
```

### 2. ハンドラーの再利用

```typescript
// ✅ GOOD: ハンドラーを共通化
export const getUserHandler = http.get('/api/users/:id', ({ params }) => {
  return HttpResponse.json(userFactory.build({ id: params.id as string }));
});

// テストで使用
server.use(getUserHandler);

// Storybookで使用
parameters: {
  msw: {
    handlers: [getUserHandler],
  },
}

// ❌ BAD: 各所で重複定義
```

### 3. エラーハンドラーの分離

```typescript
// ✅ GOOD: エラー専用ハンドラー
export const userErrorHandlers = {
  notFound: http.get('/api/users/:id', () => {
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
  
  serverError: http.get('/api/users', () => {
    return HttpResponse.json({ message: 'Server error' }, { status: 500 });
  }),
  
  unauthorized: http.get('/api/users', () => {
    return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }),
};

// テストで使用
server.use(userErrorHandlers.notFound);
```

### 4. 型安全なハンドラー

```typescript
import { User } from '@/types';

// ✅ GOOD: 型を明示
http.get('/api/users/:id', ({ params }): HttpResponse<User> => {
  const user: User = userFactory.build({ id: params.id as string });
  return HttpResponse.json(user);
});
```

### 5. リクエスト検証

```typescript
// ✅ GOOD: リクエスト検証
http.post('/api/users', async ({ request }) => {
  const contentType = request.headers.get('Content-Type');

  if (!contentType?.includes('application/json')) {
    return HttpResponse.json(
      { message: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }

  const body = await request.json();
  
  // zodでバリデーション
  const result = CreateUserSchema.safeParse(body);
  
  if (!result.success) {
    return HttpResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  return HttpResponse.json(userFactory.build(result.data), { status: 201 });
});
```

### 6. 環境別ハンドラー

```typescript
// ✅ GOOD: 環境別に切り替え
const handlers = process.env.NODE_ENV === 'test'
  ? [...authHandlers, ...userHandlers, ...orderHandlers]
  : [...authHandlers]; // 開発環境では認証のみモック

export { handlers };
```

### 7. レスポンスの一貫性

```typescript
// ✅ GOOD: 統一されたエラーレスポンス形式
interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}

http.post('/api/users', async ({ request }) => {
  const body = await request.json();
  
  if (!body.email) {
    const errorResponse: ErrorResponse = {
      message: 'バリデーションエラー',
      errors: {
        email: ['メールアドレスは必須です'],
      },
      code: 'VALIDATION_ERROR',
    };
    
    return HttpResponse.json(errorResponse, { status: 400 });
  }
  
  // ...
});
```

### 8. ハンドラーのテスト

```typescript title="src/tests/msw/handlers/userHandlers.test.ts"
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { userHandlers } from './userHandlers';

const server = setupServer(...userHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('GET /api/users returns user list', async () => {
  const response = await fetch('http://localhost/api/users');
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThan(0);
});

test('POST /api/users creates user', async () => {
  const newUser = {
    name: 'Test User',
    email: 'test@example.com',
  };

  const response = await fetch('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newUser),
  });

  const data = await response.json();

  expect(response.status).toBe(201);
  expect(data.name).toBe(newUser.name);
  expect(data.email).toBe(newUser.email);
});
```

---

## まとめ

このガイドでは、MSW 2.xを使ったAPIモックの基本から実践的なテクニックまでを説明しました。

### 重要なポイント

1. **ハンドラーをドメイン別に整理する**
2. **Factoryパターンでテストデータを生成する**
3. **エラーハンドラーを分離して再利用する**
4. **zodスキーマでリクエストを検証する**
5. **状態を持つハンドラーで複雑なシナリオをテストする**
6. **デバッグログで問題を早期発見する**
7. **型安全なハンドラーを書く**

### MSWの使い分け

| テスト種別 | MSW使用 | 理由 |
|----------|---------|------|
| **Vitest Unit Tests** | ✅ 使用 | API依存を排除して高速化 |
| **Storybook** | ✅ 使用 | UIカタログに最適 |
| **Playwright E2E** | ⚠️ 選択的 | 実APIテストが基本、必要に応じてMSW |

### 次のステップ

- [Factory Pattern詳細ガイド](./factory-pattern.md) - テストデータ生成の詳細
- [Vitest詳細ガイド](./vitest-guide.md) - ユニットテスト
- [Storybook詳細ガイド](./storybook-guide.md) - UIカタログ
- [トラブルシューティング](./troubleshooting.md) - 問題解決ガイド

---

**困ったときは [トラブルシューティング](./troubleshooting.md) または [FAQ](./faq.md) を参照してください。**
