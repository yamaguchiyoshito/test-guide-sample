# Storybook 詳細ガイド

## 目次

1. [Storybookとは](#storybookとは)
2. [環境構築](#環境構築)
3. [基本的なStoryの作成](#基本的なstoryの作成)
4. [Args と Controls](#argsとcontrols)
5. [Decorators](#decorators)
6. [Interaction Tests](#interaction-tests)
7. [MSW統合](#msw統合)
8. [Accessibility Testing](#accessibility-testing)
9. [ドキュメント自動生成](#ドキュメント自動生成)
10. [Visual Regression Testing](#visual-regression-testing)
11. [パフォーマンス最適化](#パフォーマンス最適化)
12. [CI/CD統合](#cicd統合)
13. [ベストプラクティス](#ベストプラクティス)

---

## Storybookとは

Storybookは、UIコンポーネントの開発・テスト・ドキュメント化を支援するツールです。コンポーネントを独立した環境で開発し、さまざまな状態を視覚的に確認できます。

### 主な用途

| 用途 | 説明 |
|-----|------|
| **コンポーネント開発** | アプリケーションから独立してUIを開発 |
| **UIカタログ** | デザインシステムの可視化 |
| **インタラクションテスト** | ユーザー操作のテスト |
| **アクセシビリティ検証** | WCAG準拠の確認 |
| **ドキュメント** | 使用方法の自動生成 |
| **Visual Regression** | UI変更の検出 |

### プロジェクトでの位置づけ

```
テストトロフィー
┌─────────────────────────────────────────────────────────────┐
│ E2E Tests                                                   │ ← Playwright
├─────────────────────────────────────────────────────────────┤
│ Integration / Interaction Tests                             │ ← Storybook Interaction Tests ★このガイドの対象
├─────────────────────────────────────────────────────────────┤
│ Unit / Component Tests                                      │ ← Vitest + Storybook Stories
├─────────────────────────────────────────────────────────────┤
│ Static Analysis                                             │ ← TypeScript + ESLint
└─────────────────────────────────────────────────────────────┘
```

---

## 環境構築

### 依存関係のインストール

```bash
# Storybook本体
pnpm add -D storybook @storybook/nextjs

# 必須アドオン
pnpm add -D @storybook/addon-essentials
pnpm add -D @storybook/addon-interactions
pnpm add -D @storybook/addon-a11y
pnpm add -D @storybook/addon-vitest

# MSW統合
pnpm add -D msw-storybook-addon

# テスト関連
pnpm add -D @storybook/test
pnpm add -D @storybook/test-runner
```

### Storybook設定ファイル

```typescript title=".storybook/main.ts"
import type { StorybookConfig } from '@storybook/nextjs';
import path from 'path';

const config: StorybookConfig = {
  // Storiesの場所
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],

  // アドオン
  addons: [
    '@storybook/addon-essentials',      // 基本機能（Controls, Actions, Docs等）
    '@storybook/addon-interactions',    // Interaction Tests
    '@storybook/addon-a11y',           // アクセシビリティ検証
    '@storybook/addon-vitest',         // Vitest統合
  ],

  // フレームワーク
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },

  // ドキュメント
  docs: {
    autodocs: 'tag', // 'tag'でコンポーネントに@autodocsタグが必要
  },

  // 静的ファイル
  staticDirs: ['../public'],

  // TypeScript設定
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        // node_modules内のpropsを除外
        return prop.parent
          ? !/node_modules/.test(prop.parent.fileName)
          : true;
      },
    },
  },

  // ビルド最適化
  core: {
    disableTelemetry: true,
  },

  // Webpackカスタマイズ（必要に応じて）
  webpackFinal: async (config) => {
    // パスエイリアス
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, '../src'),
      };
    }
    return config;
  },
};

export default config;
```

### Preview設定

```typescript title=".storybook/preview.tsx"
import type { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/tests/msw/handlers';
import '../src/app/globals.css'; // Tailwind CSS等のグローバルスタイル

// MSW初期化
initialize({
  onUnhandledRequest: 'warn',
});

const preview: Preview = {
  // パラメーター設定
  parameters: {
    // MSWハンドラー（デフォルト）
    msw: {
      handlers: handlers,
    },

    // Actions
    actions: { 
      argTypesRegex: '^on[A-Z].*' 
    },

    // Controls
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true, // Controlsパネルを展開
    },

    // レイアウト
    layout: 'centered', // デフォルトレイアウト

    // ビューポート
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1920px', height: '1080px' },
        },
      },
    },

    // 背景色
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
        { name: 'gray', value: '#f5f5f5' },
      ],
    },
  },

  // グローバルDecorator
  decorators: [
    (Story) => (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Story />
      </div>
    ),
  ],

  // MSWローダー
  loaders: [mswLoader],

  // タグ
  tags: ['autodocs'],
};

export default preview;
```

### package.json スクリプト

```json title="package.json"
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "storybook:test": "test-storybook",
    "storybook:coverage": "test-storybook --coverage"
  }
}
```

---

## 基本的なStoryの作成

### シンプルなButtonコンポーネント

```typescript title="src/components/Button/Button.tsx"
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-sm',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
```

### Button Stories

```typescript title="src/components/Button/Button.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from './Button';

/**
 * ボタンコンポーネント
 * 
 * アクションをトリガーするためのクリック可能な要素です。
 */
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'ghost'],
      description: 'ボタンの視覚的スタイル',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'ボタンのサイズ',
    },
    disabled: {
      control: 'boolean',
      description: '無効状態',
    },
    onClick: {
      action: 'clicked',
      description: 'クリック時のコールバック',
    },
  },
  args: {
    onClick: fn(), // アクションロギング
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * デフォルトのボタン
 */
export const Default: Story = {
  name: 'デフォルト',
  args: {
    children: 'ボタン',
  },
};

/**
 * プライマリアクション用
 */
export const Primary: Story = {
  name: 'プライマリアクション',
  args: {
    variant: 'default',
    children: '送信',
  },
};

/**
 * 破壊的なアクション用（削除など）
 */
export const Destructive: Story = {
  name: '破壊的アクション',
  args: {
    variant: 'destructive',
    children: '削除',
  },
};

/**
 * アウトラインスタイル
 */
export const Outline: Story = {
  name: 'アウトライン',
  args: {
    variant: 'outline',
    children: 'キャンセル',
  },
};

/**
 * ゴーストスタイル（背景なし）
 */
export const Ghost: Story = {
  name: 'ゴースト',
  args: {
    variant: 'ghost',
    children: '閉じる',
  },
};

/**
 * 小サイズ
 */
export const Small: Story = {
  name: '小サイズ',
  args: {
    size: 'sm',
    children: '小さいボタン',
  },
};

/**
 * 大サイズ
 */
export const Large: Story = {
  name: '大サイズ',
  args: {
    size: 'lg',
    children: '大きいボタン',
  },
};

/**
 * 無効状態
 */
export const Disabled: Story = {
  name: '無効状態',
  args: {
    disabled: true,
    children: '無効なボタン',
  },
};

/**
 * アイコンのみ
 */
export const Icon: Story = {
  name: 'アイコンのみ',
  args: {
    size: 'icon',
    children: '×',
    'aria-label': '閉じる',
  },
};

/**
 * すべてのバリエーション
 */
export const AllVariants: Story = {
  name: '全バリエーション',
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="default">Default</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex gap-2">
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),
};
```

---

## Args と Controls

### Argsの基本

Argsは、Storyに渡すpropsの値です。Controlsパネルで動的に変更できます。

```typescript title="src/components/Input/Input.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
      description: '入力タイプ',
    },
    placeholder: {
      control: 'text',
      description: 'プレースホルダー',
    },
    disabled: {
      control: 'boolean',
      description: '無効状態',
    },
    required: {
      control: 'boolean',
      description: '必須',
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'デフォルト',
  args: {
    placeholder: 'テキストを入力してください',
  },
};

export const Email: Story = {
  name: 'メール入力',
  args: {
    type: 'email',
    placeholder: 'email@example.com',
  },
};

export const Password: Story = {
  name: 'パスワード入力',
  args: {
    type: 'password',
    placeholder: 'パスワードを入力',
  },
};

export const Disabled: Story = {
  name: '無効状態',
  args: {
    disabled: true,
    placeholder: '無効な入力欄',
  },
};
```

### ArgTypesの詳細設定

```typescript
const meta = {
  title: 'Components/Select',
  component: Select,
  argTypes: {
    // セレクトコントロール
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },

    // ラジオボタン
    variant: {
      control: { type: 'radio' },
      options: ['primary', 'secondary'],
    },

    // インラインラジオ
    alignment: {
      control: { type: 'inline-radio' },
      options: ['left', 'center', 'right'],
    },

    // チェックボックス
    features: {
      control: { type: 'check' },
      options: ['feature1', 'feature2', 'feature3'],
    },

    // レンジスライダー
    opacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
    },

    // カラーピッカー
    backgroundColor: {
      control: { type: 'color' },
    },

    // 日付
    createdAt: {
      control: { type: 'date' },
    },

    // オブジェクト
    config: {
      control: { type: 'object' },
    },

    // テキストエリア
    description: {
      control: { type: 'text' },
    },

    // アクションから除外
    onInternalChange: {
      table: { disable: true },
    },
  },
} satisfies Meta<typeof Select>;
```

---

## Decorators

Decoratorsは、Storyをラップして追加のコンテキストを提供します。

### グローバルDecorator（全Storyに適用）

```typescript title=".storybook/preview.tsx"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const preview: Preview = {
  decorators: [
    // react-query Decorator
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },

    // レイアウトDecorator
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
};
```

### Story単位のDecorator

```typescript title="src/components/UserCard/UserCard.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { UserCard } from './UserCard';

const meta = {
  title: 'Components/UserCard',
  component: UserCard,
  decorators: [
    // 背景装飾
    (Story) => (
      <div style={{ backgroundColor: '#f5f5f5', padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'デフォルト',
  args: {
    userId: 'user-1',
  },
};

// 個別のStoryにのみDecorator適用
export const WithBorder: Story = {
  name: '枠線付き',
  args: {
    userId: 'user-2',
  },
  decorators: [
    (Story) => (
      <div style={{ border: '2px solid red' }}>
        <Story />
      </div>
    ),
  ],
};
```

### 便利なDecorator例

```typescript title=".storybook/decorators/index.tsx"
import { Decorator } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * react-query Decorator
 */
export const QueryClientDecorator: Decorator = (Story) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};

/**
 * Next.js Router Mock Decorator
 */
export const RouterDecorator: Decorator = (Story) => {
  return <Story />;
};

/**
 * Dark Mode Decorator
 */
export const DarkModeDecorator: Decorator = (Story) => (
  <div className="dark">
    <div className="bg-background text-foreground min-h-screen p-8">
      <Story />
    </div>
  </div>
);

/**
 * 中央配置Decorator
 */
export const CenterDecorator: Decorator = (Story) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '100vh' 
  }}>
    <Story />
  </div>
);
```

---

## Interaction Tests

Interaction Testsは、ユーザー操作をシミュレートしてコンポーネントの動作を検証します。

### 基本的なInteraction Test

```typescript title="src/components/Counter/Counter.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { Counter } from './Counter';

const meta = {
  title: 'Components/Counter',
  component: Counter,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Counter>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * デフォルト状態
 */
export const Default: Story = {
  name: 'デフォルト',
  args: {
    initialValue: 0,
  },
};

/**
 * インクリメント操作
 */
export const IncrementInteraction: Story = {
  name: 'インクリメント操作',
  args: {
    initialValue: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 初期値を確認
    await expect(canvas.getByText('カウント: 0')).toBeInTheDocument();

    // +1ボタンをクリック
    const incrementButton = canvas.getByRole('button', { name: '+1' });
    await userEvent.click(incrementButton);

    // 値が増えたことを確認
    await expect(canvas.getByText('カウント: 1')).toBeInTheDocument();

    // もう一度クリック
    await userEvent.click(incrementButton);
    await expect(canvas.getByText('カウント: 2')).toBeInTheDocument();
  },
};

/**
 * デクリメント操作
 */
export const DecrementInteraction: Story = {
  name: 'デクリメント操作',
  args: {
    initialValue: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('カウント: 5')).toBeInTheDocument();

    const decrementButton = canvas.getByRole('button', { name: '-1' });
    await userEvent.click(decrementButton);

    await expect(canvas.getByText('カウント: 4')).toBeInTheDocument();
  },
};

/**
 * リセット操作
 */
export const ResetInteraction: Story = {
  name: 'リセット操作',
  args: {
    initialValue: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // カウントアップ
    const incrementButton = canvas.getByRole('button', { name: '+1' });
    await userEvent.click(incrementButton);
    await userEvent.click(incrementButton);
    await userEvent.click(incrementButton);

    await expect(canvas.getByText('カウント: 3')).toBeInTheDocument();

    // リセット
    const resetButton = canvas.getByRole('button', { name: 'リセット' });
    await userEvent.click(resetButton);

    await expect(canvas.getByText('カウント: 0')).toBeInTheDocument();
  },
};
```

### フォーム入力のInteraction Test

```typescript title="src/components/LoginForm/LoginForm.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, waitFor } from '@storybook/test';
import { fn } from '@storybook/test';
import { LoginForm } from './LoginForm';

const meta = {
  title: 'Components/LoginForm',
  component: LoginForm,
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 正常なログイン操作
 */
export const SuccessfulLogin: Story = {
  name: '正常ログイン',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // メールアドレス入力
    const emailInput = canvas.getByLabelText('メールアドレス');
    await userEvent.type(emailInput, 'test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    // パスワード入力
    const passwordInput = canvas.getByLabelText('パスワード');
    await userEvent.type(passwordInput, 'password123');
    await expect(passwordInput).toHaveValue('password123');

    // 送信
    const submitButton = canvas.getByRole('button', { name: 'ログイン' });
    await userEvent.click(submitButton);

    // onSubmitが呼ばれたことを確認
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  },
};

/**
 * バリデーションエラー
 */
export const ValidationError: Story = {
  name: 'バリデーションエラー',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 空のまま送信
    const submitButton = canvas.getByRole('button', { name: 'ログイン' });
    await userEvent.click(submitButton);

    // エラーメッセージが表示される
    await waitFor(() => {
      expect(canvas.getByText('メールアドレスを入力してください')).toBeInTheDocument();
      expect(canvas.getByText('パスワードを入力してください')).toBeInTheDocument();
    });
  },
};

/**
 * パスワード表示切り替え
 */
export const TogglePasswordVisibility: Story = {
  name: 'パスワード表示切替',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const passwordInput = canvas.getByLabelText('パスワード');
    await userEvent.type(passwordInput, 'secret');

    // 初期状態はtype="password"
    expect(passwordInput).toHaveAttribute('type', 'password');

    // 表示ボタンをクリック
    const toggleButton = canvas.getByRole('button', { name: 'パスワードを表示' });
    await userEvent.click(toggleButton);

    // type="text"に変わる
    expect(passwordInput).toHaveAttribute('type', 'text');

    // もう一度クリックで非表示に戻る
    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  },
};
```

---

## MSW統合

### MSWハンドラーの設定

```typescript title="src/components/UserList/UserList.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse, delay } from 'msw';
import { within, expect, waitFor } from '@storybook/test';
import { userFactory } from '@/tests/factories/userFactory';
import { UserList } from './UserList';

const meta = {
  title: 'Components/UserList',
  component: UserList,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof UserList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 通常のユーザー一覧
 */
export const Default: Story = {
  name: '通常一覧',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          const users = userFactory.buildList(5);
          return HttpResponse.json(users);
        }),
      ],
    },
  },
};

/**
 * 空の一覧
 */
export const Empty: Story = {
  name: '空一覧',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json([]);
        }),
      ],
    },
  },
};

/**
 * ローディング状態
 */
export const Loading: Story = {
  name: 'ローディング状態',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', async () => {
          await delay('infinite'); // 無限待機
          return HttpResponse.json([]);
        }),
      ],
    },
  },
};

/**
 * エラー状態
 */
export const Error: Story = {
  name: 'エラー状態',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json(
            { message: 'サーバーエラー' },
            { status: 500 }
          );
        }),
      ],
    },
  },
};

/**
 * 大量データ
 */
export const LargeDataset: Story = {
  name: '大量データ',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          const users = userFactory.buildList(100);
          return HttpResponse.json(users);
        }),
      ],
    },
  },
};

/**
 * データフェッチ後のインタラクション
 */
export const FilterInteraction: Story = {
  name: 'フィルター操作',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          const users = userFactory.buildList(10);
          return HttpResponse.json(users);
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // データ読み込み完了を待機
    await waitFor(() => {
      expect(canvas.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    // 検索フィルター入力
    const searchInput = canvas.getByPlaceholderText('ユーザーを検索');
    await userEvent.type(searchInput, 'Alice');

    // フィルタリング結果を確認
    await waitFor(() => {
      const items = canvas.getAllByRole('listitem');
      items.forEach(item => {
        expect(item.textContent).toContain('Alice');
      });
    });
  },
};
```

### 動的なMSWレスポンス

```typescript
export const DynamicResponse: Story = {
  name: '動的レスポンス',
  parameters: {
    msw: {
      handlers: [
        http.post('/api/users', async ({ request }) => {
          const body = await request.json();
          
          // リクエストボディに基づいてレスポンス生成
          const newUser = userFactory.build({
            name: body.name,
            email: body.email,
          });
          
          return HttpResponse.json(newUser, { status: 201 });
        }),
      ],
    },
  },
};
```

---

## Accessibility Testing

### a11y アドオンの使用

```typescript title="src/components/Form/Form.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { Form } from './Form';

const meta = {
  title: 'Components/Form',
  component: Form,
  parameters: {
    // アクセシビリティチェックを有効化
    a11y: {
      config: {
        rules: [
          {
            // 特定のルールを無効化（必要な場合のみ）
            id: 'color-contrast',
            enabled: false,
          },
        ],
      },
    },
  },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * アクセシブルなフォーム
 */
export const Accessible: Story = {
  name: 'アクセシブル',
  args: {
    // すべてのinputにlabelが関連付けられている
    fields: [
      { id: 'name', label: '名前', type: 'text', required: true },
      { id: 'email', label: 'メールアドレス', type: 'email', required: true },
    ],
  },
};

/**
 * アクセシビリティ違反の例（学習用）
 */
export const Inaccessible: Story = {
  name: '非アクセシブル（学習用）',
  args: {
    // labelなし、aria-labelなし
    fields: [
      { id: 'name', placeholder: '名前', type: 'text' },
      { id: 'email', placeholder: 'メール', type: 'email' },
    ],
  },
  parameters: {
    // この Story では a11y チェックを無効化
    a11y: { disable: true },
  },
};
```

### ARIA属性の検証

```typescript title="src/components/Dialog/Dialog.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { within, expect } from '@storybook/test';
import { Dialog } from './Dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 適切なARIA属性
 */
export const WithARIA: Story = {
  name: 'ARIA属性あり',
  args: {
    open: true,
    title: '確認',
    description: 'この操作を実行してもよろしいですか？',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // role="dialog" を確認
    const dialog = canvas.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // aria-labelledby を確認
    expect(dialog).toHaveAttribute('aria-labelledby');

    // aria-describedby を確認
    expect(dialog).toHaveAttribute('aria-describedby');

    // aria-modal を確認
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  },
};
```

---

## ドキュメント自動生成

### Autodocs の有効化

```typescript title="src/components/Card/Card.stories.tsx"
import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

/**
 * カードコンポーネント
 * 
 * コンテンツをカード形式で表示するコンポーネントです。
 * 
 * ## 使用例
 * 
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>タイトル</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     コンテンツ
 *   </CardContent>
 * </Card>
 * ```
 */
const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'], // 自動ドキュメント生成
  argTypes: {
    className: {
      description: '追加のCSSクラス名',
      control: 'text',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;
```

### MDXでカスタムドキュメント

```mdx title="src/components/Button/Button.mdx"
import { Meta, Canvas, Story, Controls } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

ボタンコンポーネントは、ユーザーアクションをトリガーするための基本的なUI要素です。

## 使用方法

```tsx
import { Button } from '@/components/ui/button';

function MyComponent() {
  return (
    <Button onClick={() => alert('クリック!')}>
      クリック
    </Button>
  );
}
```

## バリエーション

### デフォルト

<Canvas of={ButtonStories.Default} />

### 破壊的アクション

削除や取り消し不可能な操作に使用します。

<Canvas of={ButtonStories.Destructive} />

### アウトライン

セカンダリアクションに適しています。

<Canvas of={ButtonStories.Outline} />

## Props

<Controls of={ButtonStories.Default} />

## アクセシビリティ

- すべてのボタンには適切な `aria-label` または視覚的なテキストが必要です
- アイコンのみのボタンには必ず `aria-label` を設定してください
- キーボード操作（Enter/Space）に対応しています
```

---

## Visual Regression Testing

Chromaticが使用できない前提で、OSS技術を使ったVRTの実装例です。

### Playwrightによるスクリーンショット比較

```typescript title="e2e/visual/components.spec.ts"
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('Button - すべてのバリエーション', async ({ page }) => {
    // Storybookの特定のStoryに移動
    await page.goto('http://localhost:6006/?path=/story/components-button--all-variants');

    // iframe内のコンテンツを取得
    const storyFrame = page.frameLocator('#storybook-preview-iframe');
    const story = storyFrame.locator('#storybook-root');

    // スクリーンショット比較
    await expect(story).toHaveScreenshot('button-variants.png', {
      maxDiffPixels: 100,
    });
  });

  test('UserCard - デフォルト', async ({ page }) => {
    await page.goto('http://localhost:6006/?path=/story/components-usercard--default');

    const storyFrame = page.frameLocator('#storybook-preview-iframe');
    const story = storyFrame.locator('#storybook-root');

    await expect(story).toHaveScreenshot('usercard-default.png');
  });
});
```

### Storybook Test Runnerによる自動VRT

```bash
# Storybook Test Runner は「依存関係のインストール」で追加済み
pnpm list @storybook/test-runner
```

```typescript title=".storybook/test-runner.ts"
import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    // 各Storyのスクリーンショットを取得して比較
    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: `__snapshots__/${context.id}`,
      customSnapshotIdentifier: context.id,
    });
  },
};

export default config;
```

```bash
# Test Runner実行
pnpm exec test-storybook

# スナップショット更新
pnpm exec test-storybook --updateSnapshot
```

---

## パフォーマンス最適化

### Lazy Compilation

```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: 'vite.config.ts',
      },
    },
  },

  viteFinal: async (config) => {
    return {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        include: [
          ...(config.optimizeDeps?.include || []),
          '@storybook/blocks',
        ],
      },
    };
  },
};
```

### Storiesの遅延ロード

```typescript title=".storybook/main.ts"
const config: StorybookConfig = {
  stories: [
    // メインストーリー（常にロード）
    '../src/components/**/*.stories.@(js|jsx|ts|tsx)',
    
    // 開発時のみロード
    ...(process.env.NODE_ENV === 'development'
      ? ['../src/**/*.dev.stories.@(js|jsx|ts|tsx)']
      : []),
  ],
};
```

### ビルド最適化

```bash
# 本番ビルド時のキャッシュ無効化
pnpm exec storybook build --no-manager-cache

# 静的ビルドのみ（開発サーバーなし）
pnpm exec storybook build --quiet
```

---

## CI/CD統合

### GitLab CI設定

```yaml title=".gitlab-ci.yml"
stages:
  - build
  - test

# Storybookビルド
storybook:build:
  stage: build
  image: node:20
  before_script:
    - corepack enable
    - pnpm install --frozen-lockfile
  script:
    - pnpm build-storybook
  artifacts:
    paths:
      - storybook-static/
    expire_in: 7 days

# Interaction Tests
storybook:test:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.0-jammy
  before_script:
    - corepack enable
    - pnpm install --frozen-lockfile
  script:
    - pnpm storybook --ci --port 6006 >storybook.log 2>&1 &
    - until curl -sf http://127.0.0.1:6006 >/dev/null; do sleep 1; done
    - pnpm storybook:test
  artifacts:
    when: always
    paths:
      - storybook.log
      - test-results/

# GitLab Pagesへのデプロイ（mainブランチのみ）
pages:
  stage: test
  needs: ['storybook:build']
  script:
    - mkdir public
    - cp -r storybook-static/* public/
  artifacts:
    paths:
      - public
  only:
    - main
```

---

## ベストプラクティス

### 1. Storyの粒度

```typescript
// ✅ GOOD: 1つのStoryで1つの状態を表現
export const Default: Story = { name: 'デフォルト' };
export const Loading: Story = { name: '読み込み中' };
export const Error: Story = { name: 'エラー状態' };

// ❌ BAD: 1つのStoryで複数の状態を切り替え
export const AllStates: Story = {
  name: '全状態切替（非推奨）',
  render: () => {
    const [state, setState] = useState('default');
    // ...
  },
};
```

### 2. Args vs Render関数

```typescript
// ✅ GOOD: Argsを使用（Controlsが使える）
export const Primary: Story = {
  name: 'プライマリ',
  args: {
    variant: 'primary',
    children: 'ボタン',
  },
};

// ❌ BAD: render関数でハードコード（Controlsが使えない）
export const Primary: Story = {
  name: 'プライマリ（ハードコード）',
  render: () => <Button variant="primary">ボタン</Button>,
};

// ⚠️ 複雑なレイアウトの場合はrender関数も可
export const Comparison: Story = {
  name: '比較表示',
  render: () => (
    <div>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
    </div>
  ),
};
```

### 3. MSWハンドラーの整理

```typescript
// ✅ GOOD: 各Storyで明示的にハンドラー指定
export const Success: Story = {
  name: '成功レスポンス',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => HttpResponse.json(users)),
      ],
    },
  },
};

// ✅ GOOD: 共通ハンドラーを再利用
import { userHandlers } from '@/tests/msw/handlers/userHandlers';

export const WithMSW: Story = {
  name: 'MSW適用',
  parameters: {
    msw: {
      handlers: userHandlers,
    },
  },
};
```

### 4. Interaction Testsの範囲

```typescript
// ✅ GOOD: 主要なユーザーフロー
export const LoginFlow: Story = {
  name: 'ログインフロー',
  play: async ({ canvasElement }) => {
    // メール入力 → パスワード入力 → 送信
  },
};

// ❌ BAD: すべてのエッジケース（Vitestで対応）
// 細かいバリデーションやエラー処理は単体テストで
```

### 5. ドキュメントの充実

```typescript
/**
 * プライマリボタン
 * 
 * 最も重要なアクションに使用します。
 * ページ内に1つだけ配置することを推奨します。
 * 
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleSubmit}>
 *   送信
 * </Button>
 * ```
 */
export const Primary: Story = {
  name: 'プライマリボタン',
  args: {
    variant: 'primary',
    children: '送信',
  },
};
```

### 6. Story命名規則

```typescript
// 変数名は英語、UI表示名は日本語（name必須）
export const Default: Story = {
  name: 'デフォルト',
  args: { children: 'ボタン' },
};

export const Loading: Story = {
  name: '読み込み中',
  args: { isLoading: true },
};

export const Error: Story = {
  name: 'エラー状態',
  args: { hasError: true },
};

export const Empty: Story = {
  name: '空状態',
  args: { data: [] },
};

export const Disabled: Story = {
  name: '無効状態',
  args: { disabled: true },
};

export const WithValidationError: Story = {
  name: 'バリデーションエラー',
  args: { error: '必須項目です' },
};

export const Mobile: Story = {
  name: 'モバイル表示',
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
```

#### 避けるべき命名

```typescript
// ❌ 悪い例
export const Story1: Story = {};     // 変数名が意図不明
export const Test2: Story = {};      // 変数名が意図不明
export const Example: Story = {};    // 曖昧
export const ボタン表示: Story = {}; // 変数名が日本語（ビルドエラーリスク）
export const Default: Story = {};    // nameプロパティなし
```

#### 命名のベストプラクティス

- 変数名: 英語のPascalCaseで意図が明確に分かる名前にする
- 表示名（`name`）: 日本語で誰が見ても理解できる簡潔な名前を必ず指定する
- エッジケースやバリエーション: `With〜` プレフィックスを使用する
- 状態系: 形容詞または名詞で表現する（`Loading`, `Error`, `Empty`, `Disabled` など）
- レスポンシブ対応: 画面サイズを明記する（`Mobile`, `Tablet`, `Desktop`）

---

## まとめ

このガイドでは、Storybook 10を使ったコンポーネント開発・テスト・ドキュメント化の方法を説明しました。

### 重要なポイント

1. **Storiesは1状態1Story** で明確に分ける
2. **Args と Controls** で動的に状態を変更できるようにする
3. **Decorators** でコンテキストを提供する
4. **Interaction Tests** で主要なユーザーフローを検証する
5. **MSW統合** でAPIモックを簡単に設定する
6. **Accessibility Testing** で全コンポーネントをWCAG準拠にする
7. **Autodocs** でドキュメントを自動生成する

### 次のステップ

- [Vitest詳細ガイド](./vitest-guide.md) - ユニットテスト
- [Playwright詳細ガイド](./playwright-guide.md) - E2Eテスト
- [MSW詳細ガイド](./msw-guide.md) - APIモックの詳細
- [Factory Pattern詳細ガイド](./factory-pattern.md) - テストデータ生成

---

**困ったときは [トラブルシューティング](./troubleshooting.md) または [FAQ](./faq.md) を参照してください。**
