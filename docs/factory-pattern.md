# Factory Pattern 詳細ガイド

## 目次

1. [Factory Patternとは](#factory-patternとは)
2. [環境構築](#環境構築)
3. [基本的なFactoryの作成](#基本的なfactoryの作成)
4. [faker.jsの活用](#fakerjsの活用)
5. [zodスキーマとの統合](#zodスキーマとの統合)
6. [関連データの生成](#関連データの生成)
7. [継承と拡張](#継承と拡張)
8. [決定的なテストデータ](#決定的なテストデータ)
9. [複雑なデータ構造](#複雑なデータ構造)
10. [Factoryライブラリの比較](#factoryライブラリの比較)
11. [ベストプラクティス](#ベストプラクティス)

---

## Factory Patternとは

Factory Patternは、テストデータを一貫性のある方法で生成するデザインパターンです。テストごとにデータを手動で作成する代わりに、Factoryを使って効率的にテストデータを生成します。

### なぜFactory Patternを使うのか

| 手動データ作成 | Factory Pattern |
|-------------|----------------|
| テストごとに重複コード | 一度定義すれば再利用可能 |
| データ構造変更時に全テスト修正 | Factory修正のみで対応 |
| 不完全なデータでテスト失敗 | 完全なデータを自動生成 |
| メンテナンスコスト大 | メンテナンスコスト小 |

### Factory Patternの利点

```typescript
// ❌ BAD: 手動データ作成
test('displays user name', () => {
  const user = {
    id: '1',
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    role: 'user',
    // ... 20個以上のフィールド
  };
  render(<UserCard user={user} />);
});

// ✅ GOOD: Factory Pattern
test('displays user name', () => {
  const user = userFactory.build({ name: 'Alice' });
  render(<UserCard user={user} />);
});
```

---

## 環境構築

### 依存関係のインストール

```bash
# faker.js - テストデータ生成
pnpm add -D @faker-js/faker

# zod - スキーマ検証（既にインストール済みの場合は不要）
pnpm add zod
```

### ディレクトリ構造

```bash
src/
├── tests/
│   ├── factories/
│   │   ├── index.ts              # Factory統合・エクスポート
│   │   ├── userFactory.ts        # ユーザーFactory
│   │   ├── orderFactory.ts       # 注文Factory
│   │   ├── productFactory.ts     # 商品Factory
│   │   └── helpers/              # Factory共通ヘルパー
│   │       ├── faker.ts          # faker設定
│   │       └── types.ts          # Factory型定義
│   └── msw/
│       └── handlers/
│           └── userHandlers.ts   # MSWハンドラー（Factoryを使用）
```

### faker.js 設定

```typescript title="src/tests/factories/helpers/faker.ts"
import { faker } from '@faker-js/faker';

// 日本語ロケール設定
faker.locale = 'ja';

// Seed固定で決定的なデータ生成
faker.seed(123);

export { faker };
```

---

## 基本的なFactoryの作成

### シンプルなFactory

```typescript title="src/tests/factories/userFactory.ts"
import { faker } from './helpers/faker';

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: 'user' | 'admin' | 'guest';
  createdAt: string;
  updatedAt: string;
}

export const userFactory = {
  /**
   * 単一のUserオブジェクトを生成
   */
  build: (overrides?: Partial<User>): User => {
    const now = new Date().toISOString();

    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      age: faker.number.int({ min: 18, max: 80 }),
      role: 'user',
      createdAt: now,
      updatedAt: now,
      ...overrides, // 上書き
    };
  },

  /**
   * 複数のUserオブジェクトを生成
   */
  buildList: (count: number, overrides?: Partial<User>): User[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },
};
```

### 使用例

```typescript title="src/components/UserCard/UserCard.test.tsx"
import { userFactory } from '@/tests/factories/userFactory';

test('displays user information', () => {
  // デフォルトデータ
  const user = userFactory.build();
  render(<UserCard user={user} />);

  // 特定の値を指定
  const alice = userFactory.build({ name: 'Alice', age: 25 });
  render(<UserCard user={alice} />);

  // 複数ユーザー生成
  const users = userFactory.buildList(10);
  render(<UserList users={users} />);

  // 特定の値で複数生成
  const admins = userFactory.buildList(5, { role: 'admin' });
  render(<AdminList users={admins} />);
});
```

### 専用メソッドを持つFactory

```typescript title="src/tests/factories/userFactory.ts"
export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    // ... 基本実装
  },

  buildList: (count: number, overrides?: Partial<User>): User[] => {
    // ... 基本実装
  },

  /**
   * 管理者ユーザーを生成
   */
  buildAdmin: (overrides?: Partial<User>): User => {
    return userFactory.build({
      role: 'admin',
      ...overrides,
    });
  },

  /**
   * ゲストユーザーを生成
   */
  buildGuest: (overrides?: Partial<User>): User => {
    return userFactory.build({
      role: 'guest',
      name: 'ゲスト',
      ...overrides,
    });
  },

  /**
   * 年齢指定でユーザー生成
   */
  buildWithAge: (age: number, overrides?: Partial<User>): User => {
    return userFactory.build({
      age,
      ...overrides,
    });
  },

  /**
   * メールアドレス検証済みユーザー
   */
  buildVerified: (overrides?: Partial<User>): User => {
    return userFactory.build({
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      ...overrides,
    });
  },
};
```

---

## faker.jsの活用

### 基本的なデータ型

```typescript
import { faker } from '@faker-js/faker';

// 文字列
faker.string.uuid();                    // "550e8400-e29b-41d4-a716-446655440000"
faker.string.alphanumeric(10);         // "aB3kL9mP2q"
faker.string.alpha({ length: 5 });     // "aBcDe"

// 数値
faker.number.int({ min: 1, max: 100 }); // 42
faker.number.float({ min: 0, max: 1, precision: 0.01 }); // 0.42

// 真偽値
faker.datatype.boolean();               // true

// 日付
faker.date.past();                      // 過去の日付
faker.date.future();                    // 未来の日付
faker.date.recent({ days: 7 });        // 最近7日間
faker.date.between({ from: '2024-01-01', to: '2024-12-31' });

// 配列からランダム選択
faker.helpers.arrayElement(['red', 'green', 'blue']); // "green"
faker.helpers.arrayElements(['a', 'b', 'c', 'd'], 2); // ["b", "d"]
```

### 人物データ

```typescript
// 名前
faker.person.fullName();               // "田中 太郎"
faker.person.firstName();              // "太郎"
faker.person.lastName();               // "田中"
faker.person.gender();                 // "female"
faker.person.jobTitle();               // "エンジニア"

// 連絡先
faker.internet.email();                // "taro.tanaka@example.com"
faker.internet.userName();             // "taro_tanaka"
faker.phone.number();                  // "090-1234-5678"

// プロフィール画像
faker.image.avatar();                  // "https://avatars.githubusercontent.com/..."
```

### 住所データ

```typescript
// 住所
faker.location.country();              // "日本"
faker.location.city();                 // "東京都"
faker.location.streetAddress();        // "渋谷区1-2-3"
faker.location.zipCode();              // "150-0001"
faker.location.latitude();             // 35.6762
faker.location.longitude();            // 139.6503
```

### ビジネスデータ

```typescript
// 会社
faker.company.name();                  // "株式会社山田商事"
faker.company.catchPhrase();           // "革新的なソリューション"

// 商品
faker.commerce.productName();          // "素晴らしいソファ"
faker.commerce.price();                // "1234.56"
faker.commerce.product();              // "チェア"
faker.commerce.department();           // "エレクトロニクス"

// 金融
faker.finance.accountNumber();         // "1234567890"
faker.finance.amount();                // "123.45"
faker.finance.currencyCode();          // "JPY"
```

### インターネット・テクノロジー

```typescript
// URL・ドメイン
faker.internet.url();                  // "https://example.com"
faker.internet.domainName();           // "example.com"
faker.internet.protocol();             // "https"

// パスワード
faker.internet.password();             // "aB3!xY9@"
faker.internet.password({ length: 20, memorable: true });

// ユーザーエージェント
faker.internet.userAgent();            // "Mozilla/5.0..."

// IPアドレス
faker.internet.ip();                   // "192.168.1.1"
faker.internet.ipv6();                 // "2001:0db8:85a3:..."
```

### テキスト生成

```typescript
// ダミーテキスト
faker.lorem.word();                    // "ipsum"
faker.lorem.words(3);                  // "lorem ipsum dolor"
faker.lorem.sentence();                // "Lorem ipsum dolor sit amet."
faker.lorem.paragraph();               // 長い段落テキスト
faker.lorem.paragraphs(3);             // 3段落

// 日本語テキスト（カスタム実装）
const japaneseText = () => {
  const sentences = [
    'これはテストデータです。',
    'サンプルテキストを生成しています。',
    '日本語の文章を作成します。',
  ];
  return faker.helpers.arrayElement(sentences);
};
```

### 実践例

```typescript title="src/tests/factories/productFactory.ts"
import { faker } from './helpers/faker';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  imageUrl: string;
  stock: number;
  rating: number;
  reviewCount: number;
}

export const productFactory = {
  build: (overrides?: Partial<Product>): Product => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price({ min: 100, max: 100000 })),
    currency: 'JPY',
    category: faker.commerce.department(),
    imageUrl: faker.image.url({ width: 640, height: 480 }),
    stock: faker.number.int({ min: 0, max: 100 }),
    rating: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
    reviewCount: faker.number.int({ min: 0, max: 1000 }),
    ...overrides,
  }),

  buildList: (count: number, overrides?: Partial<Product>): Product[] => {
    return Array.from({ length: count }, () => productFactory.build(overrides));
  },
};
```

---

## zodスキーマとの統合

### zodスキーマからFactoryを生成

```typescript title="src/api/schemas/userSchema.ts"
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'admin', 'guest']),
  bio: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
```

```typescript title="src/tests/factories/userFactory.ts"
import { faker } from './helpers/faker';
import { UserSchema, type User } from '@/api/schemas/userSchema';

export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    const now = new Date().toISOString();

    const user: User = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      age: faker.number.int({ min: 18, max: 80 }),
      role: 'user',
      bio: faker.lorem.sentence(),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };

    // zodスキーマで検証（開発時のみ）
    if (process.env.NODE_ENV === 'development') {
      const result = UserSchema.safeParse(user);
      if (!result.success) {
        console.error('Factory validation error:', result.error);
        throw new Error('Generated user does not match schema');
      }
    }

    return user;
  },

  buildList: (count: number, overrides?: Partial<User>): User[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },
};
```

### zodスキーマを使った境界値テスト

```typescript title="src/tests/factories/userFactory.test.ts"
import { describe, test, expect } from 'vitest';
import { userFactory } from './userFactory';
import { UserSchema } from '@/api/schemas/userSchema';

describe('userFactory', () => {
  test('generates valid user', () => {
    const user = userFactory.build();
    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  test('respects name length constraints', () => {
    // 最小長
    const userWithMinName = userFactory.build({ name: 'A' });
    expect(UserSchema.safeParse(userWithMinName).success).toBe(true);

    // 最大長
    const userWithMaxName = userFactory.build({ name: 'A'.repeat(100) });
    expect(UserSchema.safeParse(userWithMaxName).success).toBe(true);

    // 超過（エラー）
    const userWithTooLongName = userFactory.build({ name: 'A'.repeat(101) });
    expect(UserSchema.safeParse(userWithTooLongName).success).toBe(false);
  });

  test('respects age constraints', () => {
    // 最小値
    const userWithMinAge = userFactory.build({ age: 0 });
    expect(UserSchema.safeParse(userWithMinAge).success).toBe(true);

    // 最大値
    const userWithMaxAge = userFactory.build({ age: 150 });
    expect(UserSchema.safeParse(userWithMaxAge).success).toBe(true);

    // 超過（エラー）
    const userWithTooOldAge = userFactory.build({ age: 151 });
    expect(UserSchema.safeParse(userWithTooOldAge).success).toBe(false);
  });
});
```

---

## 関連データの生成

### 1対多の関係

```typescript title="src/tests/factories/orderFactory.ts"
import { faker } from './helpers/faker';
import { userFactory } from './userFactory';
import { productFactory } from './productFactory';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

export const orderItemFactory = {
  build: (overrides?: Partial<OrderItem>): OrderItem => {
    const product = productFactory.build();
    const quantity = faker.number.int({ min: 1, max: 5 });

    return {
      id: faker.string.uuid(),
      productId: product.id,
      productName: product.name,
      quantity,
      price: product.price,
      ...overrides,
    };
  },

  buildList: (count: number, overrides?: Partial<OrderItem>): OrderItem[] => {
    return Array.from({ length: count }, () => orderItemFactory.build(overrides));
  },
};

export const orderFactory = {
  build: (overrides?: Partial<Order>): Order => {
    const items = orderItemFactory.buildList(
      faker.number.int({ min: 1, max: 5 })
    );
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      id: faker.string.uuid(),
      userId: userFactory.build().id,
      items,
      total,
      status: 'pending',
      createdAt: faker.date.recent({ days: 30 }).toISOString(),
      ...overrides,
    };
  },

  buildList: (count: number, overrides?: Partial<Order>): Order[] => {
    return Array.from({ length: count }, () => orderFactory.build(overrides));
  },

  /**
   * 特定ユーザーの注文を生成
   */
  buildForUser: (userId: string, count: number = 1): Order[] => {
    return orderFactory.buildList(count, { userId });
  },
};
```

### 多対多の関係

```typescript title="src/tests/factories/postFactory.ts"
import { faker } from './helpers/faker';
import { userFactory } from './userFactory';

export interface Tag {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  authorId: string;
  title: string;
  content: string;
  tags: Tag[];
  publishedAt: string | null;
}

export const tagFactory = {
  build: (overrides?: Partial<Tag>): Tag => ({
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      'JavaScript',
      'TypeScript',
      'React',
      'Next.js',
      'テスト',
      'パフォーマンス',
    ]),
    ...overrides,
  }),

  buildList: (count: number, overrides?: Partial<Tag>): Tag[] => {
    return Array.from({ length: count }, () => tagFactory.build(overrides));
  },
};

export const postFactory = {
  build: (overrides?: Partial<Post>): Post => ({
    id: faker.string.uuid(),
    authorId: userFactory.build().id,
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    tags: tagFactory.buildList(faker.number.int({ min: 1, max: 5 })),
    publishedAt: faker.datatype.boolean() ? faker.date.past().toISOString() : null,
    ...overrides,
  }),

  buildList: (count: number, overrides?: Partial<Post>): Post[] => {
    return Array.from({ length: count }, () => postFactory.build(overrides));
  },

  /**
   * 公開済み投稿のみ生成
   */
  buildPublished: (overrides?: Partial<Post>): Post => {
    return postFactory.build({
      publishedAt: faker.date.past().toISOString(),
      ...overrides,
    });
  },

  /**
   * 下書き投稿のみ生成
   */
  buildDraft: (overrides?: Partial<Post>): Post => {
    return postFactory.build({
      publishedAt: null,
      ...overrides,
    });
  },
};
```

---

## 継承と拡張

### 基本Factoryの拡張

```typescript title="src/tests/factories/userFactory.ts"
export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    const now = new Date().toISOString();

    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: 'user',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  },

  buildList: (count: number, overrides?: Partial<User>): User[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },

  /**
   * 管理者ユーザーFactory（基本Factoryを拡張）
   */
  buildAdmin: (overrides?: Partial<User>): User => {
    return userFactory.build({
      role: 'admin',
      ...overrides,
    });
  },

  /**
   * プレミアムユーザーFactory
   */
  buildPremium: (overrides?: Partial<User>): User => {
    return userFactory.build({
      role: 'user',
      isPremium: true,
      premiumSince: faker.date.past({ years: 1 }).toISOString(),
      ...overrides,
    });
  },
};
```

### Trait パターン

```typescript
export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    // ... 基本実装
  },

  /**
   * Traitを適用してユーザー生成
   */
  buildWith: (traits: UserTrait[], overrides?: Partial<User>): User => {
    let user = userFactory.build(overrides);

    traits.forEach(trait => {
      user = trait(user);
    });

    return user;
  },
};

// Trait定義
type UserTrait = (user: User) => User;

export const userTraits = {
  admin: (user: User): User => ({
    ...user,
    role: 'admin',
  }),

  verified: (user: User): User => ({
    ...user,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
  }),

  premium: (user: User): User => ({
    ...user,
    isPremium: true,
    premiumSince: faker.date.past({ years: 1 }).toISOString(),
  }),

  withAvatar: (user: User): User => ({
    ...user,
    avatarUrl: faker.image.avatar(),
  }),
};

// 使用例
const user = userFactory.buildWith([
  userTraits.admin,
  userTraits.verified,
  userTraits.withAvatar,
]);
```

---

## 決定的なテストデータ

### Seed固定

```typescript title="src/tests/factories/helpers/faker.ts"
import { faker } from '@faker-js/faker';

// Seed固定（全テストで同じデータ生成）
faker.seed(123);

export { faker };
```

```typescript
// テストファイルで毎回同じデータが生成される
test('test1', () => {
  const user = userFactory.build();
  console.log(user.name); // 常に同じ名前
});

test('test2', () => {
  const user = userFactory.build();
  console.log(user.name); // test1と同じ名前
});
```

### テストごとにSeedリセット

```typescript
import { beforeEach } from 'vitest';
import { faker } from '@faker-js/faker';

beforeEach(() => {
  faker.seed(123); // 各テスト前にSeedリセット
});

test('test1', () => {
  const user1 = userFactory.build();
  const user2 = userFactory.build();
  // user1 と user2 は異なるデータ
});

test('test2', () => {
  const user1 = userFactory.build();
  // test1のuser1と同じデータ（Seedがリセットされたため）
});
```

### 固定値とランダム値の使い分け

```typescript
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    // ランダム値（faker使用）
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),

    // 固定値
    role: 'user',
    isActive: true,

    // 計算値
    createdAt: new Date().toISOString(),

    ...overrides,
  }),
};
```

---

## 複雑なデータ構造

### ネストされたオブジェクト

```typescript title="src/tests/factories/profileFactory.ts"
import { faker } from './helpers/faker';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio: string;
  address: Address;
  socialLinks: SocialLinks;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
}

export const addressFactory = {
  build: (overrides?: Partial<Address>): Address => ({
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    zipCode: faker.location.zipCode(),
    country: 'Japan',
    ...overrides,
  }),
};

export const socialLinksFactory = {
  build: (overrides?: Partial<SocialLinks>): SocialLinks => ({
    twitter: faker.datatype.boolean() ? `@${faker.internet.userName()}` : undefined,
    github: faker.datatype.boolean() ? faker.internet.userName() : undefined,
    linkedin: faker.datatype.boolean() ? faker.internet.userName() : undefined,
    ...overrides,
  }),
};

export const userProfileFactory = {
  build: (overrides?: Partial<UserProfile>): UserProfile => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    bio: faker.lorem.paragraph(),
    address: addressFactory.build(),
    socialLinks: socialLinksFactory.build(),
    preferences: {
      theme: faker.helpers.arrayElement(['light', 'dark']),
      language: 'ja',
      notifications: {
        email: faker.datatype.boolean(),
        push: faker.datatype.boolean(),
      },
    },
    ...overrides,
  }),
};
```

### 配列データ

```typescript title="src/tests/factories/commentFactory.ts"
import { faker } from './helpers/faker';
import { userFactory } from './userFactory';

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  likes: number;
  replies: Comment[];
  createdAt: string;
}

export const commentFactory = {
  build: (overrides?: Partial<Comment>): Comment => ({
    id: faker.string.uuid(),
    postId: faker.string.uuid(),
    authorId: userFactory.build().id,
    content: faker.lorem.sentences(2),
    likes: faker.number.int({ min: 0, max: 100 }),
    replies: [], // デフォルトは空配列
    createdAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }),

  /**
   * 返信付きコメント生成
   */
  buildWithReplies: (replyCount: number = 3): Comment => {
    const replies = Array.from({ length: replyCount }, () =>
      commentFactory.build()
    );

    return commentFactory.build({ replies });
  },

  /**
   * ネストされた返信（スレッド）生成
   */
  buildThread: (depth: number = 3): Comment => {
    if (depth <= 0) {
      return commentFactory.build();
    }

    return commentFactory.build({
      replies: [commentFactory.buildThread(depth - 1)],
    });
  },
};
```

### 条件付きデータ

```typescript
export const orderFactory = {
  build: (overrides?: Partial<Order>): Order => {
    const status = overrides?.status || 'pending';

    // ステータスに応じて異なるデータを生成
    const baseOrder: Order = {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      items: orderItemFactory.buildList(3),
      total: 0,
      status,
      createdAt: faker.date.past({ days: 30 }).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // ステータス別の追加データ
    switch (status) {
      case 'shipped':
        return {
          ...baseOrder,
          shippedAt: faker.date.recent({ days: 7 }).toISOString(),
          trackingNumber: faker.string.alphanumeric(12),
        };

      case 'delivered':
        return {
          ...baseOrder,
          shippedAt: faker.date.recent({ days: 14 }).toISOString(),
          deliveredAt: faker.date.recent({ days: 7 }).toISOString(),
          trackingNumber: faker.string.alphanumeric(12),
        };

      case 'cancelled':
        return {
          ...baseOrder,
          cancelledAt: faker.date.recent({ days: 3 }).toISOString(),
          cancelReason: faker.helpers.arrayElement([
            '在庫切れ',
            'お客様都合',
            '配送不可',
          ]),
        };

      default:
        return baseOrder;
    }
  },
};
```

---

## Factoryライブラリの比較

本プロジェクトでは**自作Factory**を採用していますが、参考として他のライブラリを紹介します。

### 自作Factory（採用）

```typescript
// ✅ 採用理由
// - シンプルで理解しやすい
// - TypeScriptとの相性が良い
// - プロジェクト固有のニーズに柔軟対応
// - 追加の依存関係なし（faker.jsのみ）

export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    ...overrides,
  }),
};
```

### Fishery（代替案）

```bash
pnpm add -D fishery
```

```typescript
import { Factory } from 'fishery';

export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: `user-${sequence}`,
  name: faker.person.fullName(),
  email: faker.internet.email(),
}));

// 使用例
const user = userFactory.build();
const users = userFactory.buildList(10);
```

### FactoryBot（代替案）

```typescript
// Ruby on Railsのfactory_botに似たAPI
import { define, build, buildList } from '@factory-bot/factory-bot';

define('user', () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
}));

const user = build('user');
const users = buildList('user', 10);
```

---

## ベストプラクティス

### 1. Factory は1ファイル1モデル

```typescript
// ✅ GOOD
// userFactory.ts - Userモデル専用
// orderFactory.ts - Orderモデル専用
// productFactory.ts - Productモデル専用

// ❌ BAD
// factories.ts - 全モデルを1ファイルに
```

### 2. 最小限の必須フィールドのみ

```typescript
// ✅ GOOD: 必須フィールドのみデフォルト値
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    ...overrides,
  }),
};

// ❌ BAD: すべてのオプショナルフィールドにデフォルト値
export const userFactory = {
  build: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    bio: faker.lorem.paragraph(), // オプショナルなのに常に生成
    avatar: faker.image.avatar(), // オプショナルなのに常に生成
    ...overrides,
  }),
};
```

### 3. 専用メソッドで意図を明確に

```typescript
// ✅ GOOD: 専用メソッドで意図が明確
const admin = userFactory.buildAdmin();
const verified = userFactory.buildVerified();

// ❌ BAD: 毎回overridesで指定
const admin = userFactory.build({ role: 'admin' });
const verified = userFactory.build({ emailVerified: true, emailVerifiedAt: '...' });
```

### 4. zodスキーマで検証

```typescript
// ✅ GOOD: 開発時にスキーマ検証
export const userFactory = {
  build: (overrides?: Partial<User>): User => {
    const user = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      ...overrides,
    };

    // 開発時のみ検証
    if (process.env.NODE_ENV === 'development') {
      UserSchema.parse(user);
    }

    return user;
  },
};
```

### 5. ドキュメントを充実させる

```typescript
/**
 * ユーザーFactory
 * 
 * テスト用のユーザーデータを生成します。
 * 
 * @example
 * ```typescript
 * // デフォルトユーザー
 * const user = userFactory.build();
 * 
 * // 特定の値を指定
 * const alice = userFactory.build({ name: 'Alice' });
 * 
 * // 管理者ユーザー
 * const admin = userFactory.buildAdmin();
 * 
 * // 複数ユーザー
 * const users = userFactory.buildList(10);
 * ```
 */
export const userFactory = {
  /**
   * 単一のユーザーを生成
   */
  build: (overrides?: Partial<User>): User => {
    // ...
  },

  /**
   * 複数のユーザーを生成
   * 
   * @param count - 生成するユーザー数
   * @param overrides - すべてのユーザーに適用する上書き値
   */
  buildList: (count: number, overrides?: Partial<User>): User[] => {
    // ...
  },
};
```

### 6. テストデータは決定的に

```typescript
// ✅ GOOD: Seed固定で決定的
import { faker } from '@faker-js/faker';
faker.seed(123);

// ❌ BAD: Math.random()使用
const user = {
  id: `user-${Math.random()}`, // 再現性なし
};
```

### 7. Factoryのテストを書く

```typescript title="src/tests/factories/userFactory.test.ts"
import { describe, test, expect } from 'vitest';
import { userFactory } from './userFactory';
import { UserSchema } from '@/api/schemas/userSchema';

describe('userFactory', () => {
  test('generates valid user', () => {
    const user = userFactory.build();
    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  test('overrides work correctly', () => {
    const user = userFactory.build({ name: 'Alice', age: 25 });
    expect(user.name).toBe('Alice');
    expect(user.age).toBe(25);
  });

  test('buildList generates correct count', () => {
    const users = userFactory.buildList(5);
    expect(users).toHaveLength(5);
  });

  test('buildAdmin generates admin user', () => {
    const admin = userFactory.buildAdmin();
    expect(admin.role).toBe('admin');
  });
});
```

---

## まとめ

このガイドでは、Factory Patternを使ったテストデータ生成の方法を説明しました。

### 重要なポイント

1. **Factory Patternでテストデータを一元管理する**
2. **faker.jsで現実的なダミーデータを生成する**
3. **zodスキーマと統合してデータの正確性を保証する**
4. **専用メソッドで意図を明確にする**
5. **Seed固定で決定的なテストを実現する**
6. **ドキュメントとテストでFactoryの品質を保つ**

### Factory Pattern のメリット

```typescript
// Before: 手動データ作成（100行のテストコード）
const user1 = { id: '1', name: 'Alice', ... }; // 20行
const user2 = { id: '2', name: 'Bob', ... };   // 20行
// ...

// After: Factory Pattern（10行のテストコード）
const user1 = userFactory.build({ name: 'Alice' });
const user2 = userFactory.build({ name: 'Bob' });
```

### 次のステップ

- [MSW詳細ガイド](./msw-guide.md) - Factoryと組み合わせてAPIモック
- [Vitest詳細ガイド](./vitest-guide.md) - Factoryを使ったユニットテスト
- [Storybook詳細ガイド](./storybook-guide.md) - FactoryとMSWでUI開発

---

**困ったときは [トラブルシューティング](./troubleshooting.md) または [FAQ](./faq.md) を参照してください。**
