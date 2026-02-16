# Vitest 詳細ガイド

## 目次

1. [Vitestとは](#vitestとは)
2. [環境構築](#環境構築)
3. [基本的な使い方](#基本的な使い方)
4. [React Componentのテスト](#react-componentのテスト)
5. [Custom Hooksのテスト](#custom-hooksのテスト)
6. [MSW統合](#msw統合)
7. [カバレッジ測定](#カバレッジ測定)
8. [モックとスタブ](#モックとスタブ)
9. [非同期テスト](#非同期テスト)
10. [パフォーマンス最適化](#パフォーマンス最適化)
11. [ベストプラクティス](#ベストプラクティス)
12. [Storybook・Playwright連携](#storybookplaywright連携)

---

## Vitestとは

Vitestは、Viteをベースとした高速なユニットテストフレームワークです。本プロジェクトでは、Pure Functions、Custom Hooks、React Componentsのテストに使用し、Storybook/Playwrightと責務分離して運用します。

### Jestとの違い

| 項目 | Vitest | Jest |
|-----|--------|------|
| **実行速度** | 非常に高速（Vite HMR活用） | 中程度 |
| **ESM対応** | ネイティブサポート | 設定が複雑 |
| **設定** | Viteと共通設定 | 独自設定必要 |
| **Watch Mode** | 高速なHMR | 標準的 |
| **TypeScript** | 追加設定不要 | ts-jest必要 |

### プロジェクトでの位置づけ

```
テストトロフィー
┌─────────────────────────────────────────────────────────────┐
│ E2E Tests                                                   │ ← Playwright（少数）
├─────────────────────────────────────────────────────────────┤
│ Integration / Component Tests                               │ ← Vitest + Testing Library + MSW（中心）★このガイドの対象
├─────────────────────────────────────────────────────────────┤
│ Unit Tests                                                  │ ← Vitest（ビジネスロジック）
├─────────────────────────────────────────────────────────────┤
│ Static Analysis                                             │ ← TypeScript + ESLint
└─────────────────────────────────────────────────────────────┘
```

---

## 環境構築

### 依存関係のインストール

```bash
# 必須パッケージ
pnpm add -D vitest @vitest/ui @vitest/coverage-v8

# React Testing Library関連
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# その他
pnpm add -D jsdom happy-dom
```

### Vitest設定ファイル

```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // グローバル設定
    globals: true,
    
    // テスト環境（jsdomまたはhappy-dom）
    environment: 'jsdom',
    
    // セットアップファイル
    setupFiles: ['./src/tests/setup.ts'],
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/types/**',
        '**/tests/**',
        '**/*.d.ts',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    
    // 並列実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 8,
      },
    },
    
    // テストタイムアウト
    testTimeout: 10000,
    
    // 分離設定
    isolate: true,
    
    // レポーター
    reporters: ['default', 'html'],
  },
  
  // パスエイリアス
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/tests': path.resolve(__dirname, './src/tests'),
    },
  },
});
```

### セットアップファイル

```typescript title="src/tests/setup.ts"
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './msw/server';

// MSW サーバー起動
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: 'error' // 未定義のリクエストでエラー
  });
});

// 各テスト後のクリーンアップ
afterEach(() => {
  cleanup(); // React DOMクリーンアップ
  server.resetHandlers(); // MSWハンドラーリセット
  vi.clearAllMocks(); // モッククリア
});

// MSW サーバー停止
afterAll(() => {
  server.close();
});

// グローバルモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

// window.matchMedia モック
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// IntersectionObserver モック
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
```

### package.json スクリプト

```json title="package.json"
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:report:json": "vitest run --reporter=default --reporter=json --outputFile=test-results/vitest-results.json",
    "test:watch": "vitest --watch",
    "test:related": "vitest related",
    "storybook:test": "test-storybook",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## 基本的な使い方

### Pure Functionのテスト

```typescript title="src/lib/utils.ts"
/**
 * 配列の合計を計算する
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, num) => acc + num, 0);
}

/**
 * 配列の平均を計算する
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error('配列が空です');
  }
  return sum(numbers) / numbers.length;
}

/**
 * 金額をフォーマットする
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

/**
 * 文字列を切り詰める
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}
```

```typescript title="src/lib/utils.test.ts"
import { describe, test, expect } from 'vitest';
import { sum, average, formatCurrency, truncate } from './utils';

describe('sum', () => {
  test('正の数値の合計を計算する', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15);
  });

  test('負の数値を含む合計を計算する', () => {
    expect(sum([10, -5, 3])).toBe(8);
  });

  test('空配列の場合は0を返す', () => {
    expect(sum([])).toBe(0);
  });

  test('小数点を含む計算を正しく行う', () => {
    expect(sum([0.1, 0.2])).toBeCloseTo(0.3);
  });

  test('単一要素の配列', () => {
    expect(sum([42])).toBe(42);
  });
});

describe('average', () => {
  test('平均値を正しく計算する', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3);
  });

  test('小数の平均値を計算する', () => {
    expect(average([1, 2, 3])).toBeCloseTo(2);
  });

  test('空配列の場合はエラーをスローする', () => {
    expect(() => average([])).toThrow('配列が空です');
  });

  test('負の数値を含む平均を計算する', () => {
    expect(average([-5, 0, 5])).toBe(0);
  });
});

describe('formatCurrency', () => {
  test('正の金額を正しくフォーマットする', () => {
    expect(formatCurrency(1000)).toBe('¥1,000');
  });

  test('0円を正しくフォーマットする', () => {
    expect(formatCurrency(0)).toBe('¥0');
  });

  test('負の金額を正しくフォーマットする', () => {
    expect(formatCurrency(-500)).toBe('-¥500');
  });

  test('小数点を含む金額を正しくフォーマットする', () => {
    expect(formatCurrency(1234.56)).toBe('¥1,235'); // 四捨五入
  });
});

describe('truncate', () => {
  test('最大長以下の文字列はそのまま返す', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  test('最大長を超える文字列を切り詰める', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...');
  });

  test('空文字列を処理する', () => {
    expect(truncate('', 5)).toBe('');
  });

  test('日本語文字列を切り詰める', () => {
    expect(truncate('こんにちは世界', 5)).toBe('こんにちは...');
  });
});
```

---

## React Componentのテスト

### 基本的なComponentテスト

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
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

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

export { Button, buttonVariants };
```

```typescript title="src/components/Button/Button.test.tsx"
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  test('テキストを表示する', () => {
    render(<Button>クリック</Button>);
    expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument();
  });

  test('クリックイベントが発火する', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>クリック</Button>);

    await user.click(screen.getByRole('button', { name: 'クリック' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disabled属性が動作する', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button onClick={onClick} disabled>
        クリック
      </Button>
    );

    const button = screen.getByRole('button', { name: 'クリック' });
    expect(button).toBeDisabled();

    // disabled状態ではクリックできない
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('variant="destructive" で正しいクラスが適用される', () => {
    render(<Button variant="destructive">削除</Button>);
    const button = screen.getByRole('button', { name: '削除' });
    expect(button).toHaveClass('bg-destructive');
  });

  test('size="sm" で正しいクラスが適用される', () => {
    render(<Button size="sm">小さいボタン</Button>);
    const button = screen.getByRole('button', { name: '小さいボタン' });
    expect(button).toHaveClass('h-9');
  });

  test('カスタムクラス名を追加できる', () => {
    render(<Button className="custom-class">カスタム</Button>);
    const button = screen.getByRole('button', { name: 'カスタム' });
    expect(button).toHaveClass('custom-class');
  });

  test('type属性を指定できる', () => {
    render(<Button type="submit">送信</Button>);
    const button = screen.getByRole('button', { name: '送信' });
    expect(button).toHaveAttribute('type', 'submit');
  });
});
```

### データフェッチを含むComponentテスト

```typescript title="src/components/UserProfile/UserProfile.tsx"
import { useUser } from '@/api/queries/userQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ErrorMessage';

export interface UserProfileProps {
  userId: string;
}

export const UserProfile = ({ userId }: UserProfileProps) => {
  const { data: user, isLoading, error } = useUser(userId);

  if (isLoading) {
    return (
      <Card data-testid="user-profile-loading">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <ErrorMessage error={error} data-testid="user-profile-error" />;
  }

  if (!user) {
    return null;
  }

  return (
    <Card data-testid="user-profile">
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{user.email}</p>
        <p className="text-xs text-gray-400 mt-2">
          登録日: {new Date(user.createdAt).toLocaleDateString('ja-JP')}
        </p>
      </CardContent>
    </Card>
  );
};
```

```typescript title="src/components/UserProfile/UserProfile.test.tsx"
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/tests/msw/server';
import { userFactory } from '@/tests/factories/userFactory';
import { UserProfile } from './UserProfile';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// テストごとに新しい QueryClient を作成
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // テストでは再試行しない
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

describe('UserProfile', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test('ユーザー情報を正しく表示する', async () => {
    const user = userFactory.build({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      createdAt: '2024-01-01T00:00:00Z',
    });

    server.use(
      http.get('/api/users/:id', () => HttpResponse.json(user))
    );

    render(<UserProfile userId={user.id} />, { wrapper: createWrapper() });

    // データ取得完了まで待機
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText(/登録日: 2024\/1\/1/)).toBeInTheDocument();
  });

  test('ローディング状態を表示する', () => {
    server.use(
      http.get('/api/users/:id', async () => {
        await delay('infinite'); // 無限待機
        return HttpResponse.json(userFactory.build());
      })
    );

    render(<UserProfile userId="test-id" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('user-profile-loading')).toBeInTheDocument();
  });

  test('エラー時にエラーメッセージを表示する', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json(
          { message: 'ユーザーが見つかりません' },
          { status: 404 }
        );
      })
    );

    render(<UserProfile userId="non-existent" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('user-profile-error')).toBeInTheDocument();
    });
  });

  test('ユーザーが存在しない場合は何も表示しない', async () => {
    server.use(
      http.get('/api/users/:id', () => HttpResponse.json(null))
    );

    const { container } = render(
      <UserProfile userId="null-user" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
```

---

## Custom Hooksのテスト

### renderHook を使ったテスト

```typescript title="src/hooks/useCounter.ts"
import { useState, useCallback } from 'react';

export interface UseCounterOptions {
  initialValue?: number;
  min?: number;
  max?: number;
}

export function useCounter(options: UseCounterOptions = {}) {
  const { initialValue = 0, min, max } = options;
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(prev => {
      const next = prev + 1;
      if (max !== undefined && next > max) {
        return prev;
      }
      return next;
    });
  }, [max]);

  const decrement = useCallback(() => {
    setCount(prev => {
      const next = prev - 1;
      if (min !== undefined && next < min) {
        return prev;
      }
      return next;
    });
  }, [min]);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  const setValue = useCallback((value: number | ((prev: number) => number)) => {
    setCount(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (min !== undefined && next < min) {
        return min;
      }
      if (max !== undefined && next > max) {
        return max;
      }
      return next;
    });
  }, [min, max]);

  return { count, increment, decrement, reset, setValue };
}
```

```typescript title="src/hooks/useCounter.test.ts"
import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  test('初期値が0である', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  test('初期値を指定できる', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 10 }));
    expect(result.current.count).toBe(10);
  });

  test('increment で値が増える', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  test('decrement で値が減る', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 5 }));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });

  test('reset で初期値に戻る', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 10 }));

    act(() => {
      result.current.increment();
      result.current.increment();
    });

    expect(result.current.count).toBe(12);

    act(() => {
      result.current.reset();
    });

    expect(result.current.count).toBe(10);
  });

  test('max を超えて増加しない', () => {
    const { result } = renderHook(() => useCounter({ max: 5 }));

    act(() => {
      result.current.setValue(5);
    });

    expect(result.current.count).toBe(5);

    act(() => {
      result.current.increment();
    });

    // maxを超えないので変化しない
    expect(result.current.count).toBe(5);
  });

  test('min を下回って減少しない', () => {
    const { result } = renderHook(() => useCounter({ min: 0 }));

    act(() => {
      result.current.decrement();
    });

    // minを下回らないので0のまま
    expect(result.current.count).toBe(0);
  });

  test('setValue で値を直接設定できる', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.setValue(42);
    });

    expect(result.current.count).toBe(42);
  });

  test('setValue で関数を渡せる', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 10 }));

    act(() => {
      result.current.setValue(prev => prev * 2);
    });

    expect(result.current.count).toBe(20);
  });

  test('setValue でmin/maxの範囲内に収まる', () => {
    const { result } = renderHook(() => useCounter({ min: 0, max: 10 }));

    act(() => {
      result.current.setValue(20);
    });

    expect(result.current.count).toBe(10); // maxに制限

    act(() => {
      result.current.setValue(-5);
    });

    expect(result.current.count).toBe(0); // minに制限
  });
});
```

---

## MSW統合

### MSWハンドラーのテスト内上書き

```typescript title="src/components/UserList/UserList.test.tsx"
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/msw/server';
import { userFactory } from '@/tests/factories/userFactory';
import { UserList } from './UserList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('UserList', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test('ユーザー一覧を表示する', async () => {
    const users = userFactory.buildList(3);

    server.use(
      http.get('/api/users', () => HttpResponse.json(users))
    );

    render(<UserList />, { wrapper: createWrapper() });

    await waitFor(() => {
      users.forEach(user => {
        expect(screen.getByText(user.name)).toBeInTheDocument();
      });
    });
  });

  test('空の一覧を表示する', async () => {
    server.use(
      http.get('/api/users', () => HttpResponse.json([]))
    );

    render(<UserList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
    });
  });

  test('サーバーエラー時にエラーメッセージを表示する', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { message: 'サーバーエラー' },
          { status: 500 }
        );
      })
    );

    render(<UserList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });

  test('ネットワークエラー時にエラーメッセージを表示する', async () => {
    server.use(
      http.get('/api/users', () => HttpResponse.error())
    );

    render(<UserList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });
});
```

---

## カバレッジ測定

### カバレッジレポートの確認

```bash
# カバレッジ取得
pnpm test:coverage

# 出力例
# -------------------------|---------|----------|---------|---------|-------------------
# File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
# -------------------------|---------|----------|---------|---------|-------------------
# All files                |   85.23 |    76.89 |   82.15 |   84.12 |
#  components/Button       |   100   |    100   |   100   |   100   |
#  components/UserProfile  |   95.45 |    87.5  |   100   |   94.73 | 23-25
#  lib                     |   78.26 |    66.66 |   75    |   77.77 | 45-52,67
# -------------------------|---------|----------|---------|---------|-------------------
```

### HTMLレポート確認

```bash
# カバレッジ取得後、HTMLレポートを開く
open coverage/index.html
```

### カバレッジ閾値の設定

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,      // 80%未満でエラー
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // 特定ファイルを除外
      exclude: [
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/types/**',
      ],
    },
  },
});
```

---

## モックとスタブ

### vi.fn() によるモック

```typescript
import { describe, test, expect, vi } from 'vitest';

test('コールバック関数が呼ばれる', () => {
  const callback = vi.fn();
  
  callback('hello', 123);
  
  expect(callback).toHaveBeenCalled();
  expect(callback).toHaveBeenCalledWith('hello', 123);
  expect(callback).toHaveBeenCalledTimes(1);
});

test('戻り値を設定する', () => {
  const mockFn = vi.fn();
  
  mockFn.mockReturnValue(42);
  expect(mockFn()).toBe(42);
  
  mockFn.mockReturnValueOnce(10).mockReturnValueOnce(20);
  expect(mockFn()).toBe(10);
  expect(mockFn()).toBe(20);
  expect(mockFn()).toBe(42); // デフォルトに戻る
});

test('実装を設定する', () => {
  const mockFn = vi.fn((x: number) => x * 2);
  
  expect(mockFn(5)).toBe(10);
  expect(mockFn).toHaveBeenCalledWith(5);
});
```

### vi.mock() によるモジュールモック

```typescript title="src/lib/api.ts"
export async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

```typescript title="src/lib/api.test.ts"
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fetchUser } from './api';

// fetch をモック
global.fetch = vi.fn();

describe('fetchUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('ユーザーデータを取得する', async () => {
    const mockUser = { id: '1', name: 'Alice' };
    
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockUser,
    });

    const user = await fetchUser('1');

    expect(user).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith('/api/users/1');
  });
});
```

### vi.spyOn() によるスパイ

```typescript
import { describe, test, expect, vi } from 'vitest';

test('console.log をスパイする', () => {
  const spy = vi.spyOn(console, 'log');
  
  console.log('Hello', 'World');
  
  expect(spy).toHaveBeenCalledWith('Hello', 'World');
  
  spy.mockRestore(); // 元に戻す
});
```

---

## 非同期テスト

### Promise のテスト

```typescript
import { describe, test, expect } from 'vitest';

async function fetchData() {
  return new Promise(resolve => {
    setTimeout(() => resolve('data'), 100);
  });
}

test('Promiseを返す関数', async () => {
  const data = await fetchData();
  expect(data).toBe('data');
});

test('resolves マッチャー', async () => {
  await expect(fetchData()).resolves.toBe('data');
});

test('rejects マッチャー', async () => {
  const failingPromise = Promise.reject(new Error('failed'));
  await expect(failingPromise).rejects.toThrow('failed');
});
```

### waitFor による待機

```typescript
import { waitFor } from '@testing-library/react';

test('非同期処理の完了を待つ', async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  }, {
    timeout: 3000, // 最大3秒待機
    interval: 100, // 100msごとにチェック
  });
});
```

### findBy クエリ（自動待機）

```typescript
test('findBy クエリは自動的に待機する', async () => {
  render(<AsyncComponent />);

  // findBy は要素が見つかるまで自動的に待機（デフォルト1秒）
  const element = await screen.findByText('Loaded');
  expect(element).toBeInTheDocument();
});
```

---

## パフォーマンス最適化

### 並列実行

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 8, // CPUコア数に応じて調整
      },
    },
  },
});
```

### テストの分離

```typescript title="vitest.config.ts"
export default defineConfig({
  test: {
    isolate: true, // 各テストファイルを独立したコンテキストで実行
  },
});
```

### beforeEach/afterEach の最適化

```typescript
// ❌ BAD: 毎回重い処理
describe('UserList', () => {
  let wrapper: any;
  
  beforeEach(() => {
    const queryClient = new QueryClient(); // 毎回作成
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  });
  
  test('test1', () => {
    render(<UserList />, { wrapper });
  });
});

// ✅ GOOD: 関数化して必要な時だけ作成
describe('UserList', () => {
  function createWrapper() {
    const queryClient = new QueryClient();
    return ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }
  
  test('test1', () => {
    render(<UserList />, { wrapper: createWrapper() });
  });
});
```

---

## ベストプラクティス

### 1. AAA（Arrange-Act-Assert）パターン

```typescript
test('ボタンクリックでカウントが増える', async () => {
  // Arrange: 準備
  const user = userEvent.setup();
  render(<Counter />);

  // Act: 実行
  await user.click(screen.getByRole('button', { name: '増やす' }));

  // Assert: 検証
  expect(screen.getByText('カウント: 1')).toBeInTheDocument();
});
```

### 2. テストの独立性

```typescript
// ❌ BAD: テスト間で状態共有
let sharedData: any;

test('test1', () => {
  sharedData = { value: 1 };
});

test('test2', () => {
  expect(sharedData.value).toBe(1); // test1に依存
});

// ✅ GOOD: 各テストで独立
test('test1', () => {
  const data = { value: 1 };
  expect(data.value).toBe(1);
});

test('test2', () => {
  const data = { value: 1 };
  expect(data.value).toBe(1);
});
```

### 3. 意味のあるテスト名

```typescript
// ❌ BAD
test('test1', () => { /* ... */ });
test('it works', () => { /* ... */ });

// ✅ GOOD
test('空のフォームでは送信ボタンが無効になる', () => { /* ... */ });
test('管理者ユーザーには削除ボタンが表示される', () => { /* ... */ });
```

### 4. 適切なセレクター

```typescript
// 優先順位（高 → 低）

// 1. ロール（最優先）
screen.getByRole('button', { name: '送信' });

// 2. Label
screen.getByLabelText('メールアドレス');

// 3. Placeholder
screen.getByPlaceholderText('名前を入力');

// 4. Text
screen.getByText('ようこそ');

// 5. TestId（最終手段）
screen.getByTestId('submit-button');
```

### 5. 実装詳細のテストを避ける

```typescript
// ❌ BAD: 実装詳細に依存
test('useState の内部状態', () => {
  const { result } = renderHook(() => useState(0));
  // 内部実装に依存している
});

// ✅ GOOD: ユーザーから見える振る舞い
test('カウンターが増える', async () => {
  render(<Counter />);
  await userEvent.click(screen.getByRole('button', { name: '増やす' }));
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

---

## Storybook・Playwright連携

### 責務分離（重複禁止）

| レイヤー | 実行コマンド | 主目的 | 代表ケース | やらないこと |
|---------|------------|--------|-----------|-------------|
| Unit / Component | `pnpm test:run` | ロジックとUI部品の振る舞い検証 | 入力バリデーション、表示分岐、Hook動作 | 画面遷移全体の検証 |
| Interaction | `pnpm storybook:test` | Story単位の操作回帰検証 | ボタン操作、フォーム入力、状態遷移 | 認証〜決済など複数ページフロー |
| E2E | `pnpm test:e2e` | 実ユーザーフローの最終保証 | ログイン、購入、更新/削除の完了確認 | UIバリエーションの網羅 |

### Browser Modeを使う判断基準

- 使う: `matchMedia`, `IntersectionObserver`, レイアウト計測など、`jsdom` で再現性が落ちるテスト
- 使わない: 純粋な表示/ロジック検証（`jsdom` で十分）
- ルール: Browser Modeで再現が必要なケースだけ昇格し、常用しない

```typescript title="vitest.config.ts（必要時のみ）"
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
      headless: true,
    },
  },
});
```

### CIゲートの最小構成

1. `pnpm test:run` を必須
2. `pnpm storybook:test` を必須
3. `pnpm test:e2e` はCritical Pathのみ必須

---

## まとめ

このガイドでは、Vitestを使ったテストの基本から実践的なテクニックまでを説明しました。

### 重要なポイント

1. **Pure Functions → Components → Hooks の順でテストを書く**
2. **MSW統合で実際のAPIを使わずテストする**
3. **カバレッジ80%以上を目標にする**
4. **AAA パターンでテストを構造化する**
5. **テストの独立性を保つ**
6. **Storybook/Playwrightと責務を重複させない**

### 次のステップ

- [Playwright詳細ガイド](./playwright-guide.md) - E2Eテストを学ぶ
- [Storybook詳細ガイド](./storybook-guide.md) - UIカタログとインタラクションテスト
- [MSW詳細ガイド](./msw-guide.md) - APIモックの詳細

---

**困ったときは [トラブルシューティング](./troubleshooting.md) を参照してください。**
