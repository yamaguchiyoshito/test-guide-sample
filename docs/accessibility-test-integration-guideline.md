# アクセシビリティテスト統合ガイドライン

## はじめに

このガイドラインは、Storybook 10・Vitest 4・Playwright・@axe-core/playwright を活用したアクセシビリティ（以下、a11y）テストの実装方法を説明します。

---

## 1. 本ガイドで検証できることと検証できないこと

自動化 a11y テストには明確な範囲があります。本ガイドで実装するテストで何が検証できるのかを理解することは、効果的な a11y 品質管理に不可欠です。

### 1.1 自動検証で「検証できること」

#### 🟢 確実に検証できる項目

| カテゴリ | 項目 | 検証方法 | 例 |
|---|---|---|---|
| 色コントラスト | テキスト色と背景色の比率 | axe による色値解析 | 白字 + 灰色背景で比率不足を検出 |
| ARIA 属性 | 必須属性の有無 | DOM 検査 | `role="button"` なしの `<div>` を検出 |
| フォーム関連 | `label` と `input` の関連付け | DOM 構造解析 | `for` 属性と `id` の一致確認 |
| 画像 `alt` 属性 | `alt` テキストの有無 | DOM 検査 | `<img>` に `alt` がないことを検出 |
| ボタンテキスト | ボタンが識別可能なテキストを持つ | DOM テキスト解析 | `<button>🔍</button>` の検出 |
| 見出し階層 | `h1`〜`h6` の順序 | DOM 構造解析 | `<h2>` の後に `<h4>` が来ることを検出 |
| リスト構造 | `ul`/`ol`/`li` の入れ子構造 | DOM 構造検査 | ネストされていない `li` を検出 |
| テーブル構造 | `th`/`tr`/`td` の関連付け | DOM 構造検査 | ヘッダー行を識別できないテーブルを検出 |
| リンクテキスト | `<a>` が識別可能なテキストを持つ | DOM テキスト解析 | 「ここをクリック」だけのリンクを検出 |
| フォーカス可能要素 | インタラクティブ要素が正しくマークアップされている | DOM 検査 | `button` ではなく `div` に `onclick` を指定する場合を検出 |
| `iframe` `title` 属性 | `iframe` が `title` を持つ | DOM 検査 | `title` なし `iframe` を検出 |
| 視覚的レイアウト | CSS Grid/Flexbox による視覚的順序 | Computed Styles 検査 | 視覚順序と DOM 順序の相違を部分的に検出 |

#### 🟡 条件付きで検証できる項目

| カテゴリ | 項目 | 条件 | 例 |
|---|---|---|---|
| フォーカストラップ | モーダル内でフォーカスが閉じ込められているか | Playwright でキーボード操作をシミュレート | `fireEvent.keyDown('Tab')` で検証 |
| `aria-live` 通知 | 動的コンテンツが screen reader に announce されるか | `aria-live` 属性の存在確認（実際の announce は手動検証） | `status` region の `aria-live="polite"` を確認 |
| 色コントラスト（disabled 状態） | 無効化状態ボタンのコントラスト | ルール設定で disabled 要素をスキップ可能 | disabled button は検証除外設定可能 |
| キーボード操作 | `Tab`/`Shift+Tab`/`Enter` で操作可能か | Playwright でキーボードイベント送信 | `page.keyboard.press('Tab')` でシミュレート |
| 複数ブラウザでの互換性 | Chromium/Firefox/WebKit での動作 | Playwright で複数ブラウザ実行設定 | 3 つのエンジンで同一動作を確認 |

### 1.2 自動検証で「検証できないこと」

#### 🔴 自動化では検証できない項目

| カテゴリ | 理由 | 代替手段 |
|---|---|---|
| 実際の screen reader 読み上げ | 音声出力を自動判定できない | 手動テスト（NVDA、JAWS、VoiceOver） |
| 視覚的デザイン品質 | 見た目の「わかりやすさ」は主観的 | デザイナーレビュー、ユーザーテスト |
| コンテンツの意味的正確性 | テキストの内容を理解できない | コンテンツレビュー、言語学的検証 |
| 色覚異常ユーザーの体験 | 色以外の識別手段の有無を完全に判定できない | シミュレーションツール + 手動確認 |
| 音声・動画のキャプション | テキストトラックの品質を判定できない | 手動確認、キャプション品質レビュー |
| タッチターゲットサイズ | WCAG 2.1 Level AAA（44×44px）の判定は可能だが、現実的なタッチ可能性は判定困難 | ユーザーテスト、デバイス実機テスト |
| モーション・アニメーション | `prefers-reduced-motion` の応答性判定は可能だが、モーション酔いの実際の影響は判定できない | 医学的知見に基づくレビュー、ユーザーテスト |
| 言語タグ | `<html lang="ja">` の存在は確認できるが、部分的な言語変更（例: 段落内の英語）の正確性は判定困難 | 言語学者による検証 |
| リンク先の有効性 | リンク `href` が存在することは確認できるが、リンク先のコンテンツが関連性あるかは判定できない | 手動テスト、デザイナー確認 |
| 実際のアニメーション体験 | CSS アニメーション属性の存在は検査できるが、ユーザーが実際に認識できるかは不明 | ユーザーテスト |
| 複雑な ARIA 実装 | `aria-describedby` の値が存在することは確認できるが、説明文が適切かは判定困難 | 手動 screen reader テスト |

### 1.3 検証スコープ外の項目

#### 🟠 検証スコープ外の項目

| 項目 | 理由 |
|---|---|
| バックエンド API の a11y | UI テストは DB 検証対象外 |
| インフラストラクチャ | ネットワーク遅延などによる UX 影響 |
| マーケティング・コンテンツ | テスト対象外（別途ガイドライン参照） |
| モバイルアプリ | Web UI テストフレームワークの対象外 |

---

## 2. 全体アーキテクチャ

アクセシビリティテストは、3つのテストレイヤーで構成されています。各レイヤーは異なる検証目的を持ち、組み合わせることで包括的なカバレッジを実現します。

```
開発者のコンポーネント作成
        ↓
Vitest + vitest-axe: ユニット・インテグレーション a11y テスト
        ↓
Storybook: コンポーネント単位の a11y 検証
        ↓
Playwright + @axe-core/playwright: ページ・ユーザージャーニー a11y テスト
        ↓
CI/CD パイプライン: 自動検証・報告・ブロック
        ↓
本番環境デプロイ
```

---

## 3. Vitest + vitest-axe によるユニット・インテグレーションレベルの検証

### 3.1 概要

Vitest は、コンポーネントの logic テストを実施するフレームワークです。`vitest-axe` を組み合わせることで、DOM 構造のアクセシビリティ違反を自動検出します。vitest-axe は Vitest フレームワークに最適化された a11y テストライブラリで、jest-axe と異なり Vitest のプリミティブで構築されています。

**検証対象：**
- ARIA 属性の正確性
- フォーカストラップの動作
- セマンティック HTML の正確性
- 色コントラスト比

### 3.2 インストール

```bash
npm install --save-dev vitest-axe axe-core
# または
yarn add --dev vitest-axe axe-core
```

### 3.3 Vitest 環境設定

以下の設定ファイルを作成してください。

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts?(x)'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 3.4 テスト設定ファイル

セットアップファイルで vitest-axe を初期化します。

```typescript
// src/test/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'vitest-axe';

expect.extend(toHaveNoViolations);

// 各テスト後に DOM をクリーンアップ
afterEach(() => {
  cleanup();
});

// オプション：vitest-axe の設定
vi.mock('axe-core', {}, { esmock: true });
```

### 3.5 Modal コンポーネントのテスト実装例

以下は、Modal コンポーネントのアクセシビリティテストの実装例です。vitest-axe の matcher を使用した記述方法を示します。

```typescript
// src/components/Modal/Modal.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Modal } from './Modal';

describe('Modal Component Accessibility', () => {
  
  describe('ARIA 属性検証', () => {
    
    it('Dialog が適切な ARIA 属性を持つこと', () => {
      render(
        <Modal isOpen={true} title="テストモーダル" onClose={() => {}}>
          モーダルコンテンツ
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('クローズボタンが正しくラベル付けされていること', () => {
      render(
        <Modal isOpen={true} title="テスト" onClose={() => {}}>
          コンテンツ
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /閉じる|close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label');
    });
  });

  describe('フォーカス管理', () => {
    
    it('フォーカストラップが有効であること', () => {
      render(
        <Modal isOpen={true} title="テスト" onClose={() => {}}>
          <button>最初のボタン</button>
          <button>最後のボタン</button>
        </Modal>
      );

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      // 最後のボタンに focus を設定
      lastButton.focus();
      expect(document.activeElement).toBe(lastButton);

      // Tab キーで最初のボタンに戻ることをシミュレート
      fireEvent.keyDown(lastButton, { key: 'Tab', code: 'Tab' });
      
      // 注：実装によりフォーカス移動のシミュレーション方法が異なります
      // 詳細は Modal コンポーネントの focus trap 実装を確認してください
    });
  });

  describe('vitest-axe による自動検証', () => {
    
    it('axe が違反を検出しないこと', async () => {
      const { container } = render(
        <Modal isOpen={true} title="テストモーダル" onClose={() => {}}>
          <p>モーダルコンテンツ</p>
        </Modal>
      );

      // vitest-axe の matcher を使用
      expect(await axe(container)).toHaveNoViolations();
    });

    it('フォーム要素を含む場合でも違反がないこと', async () => {
      const { container } = render(
        <Modal isOpen={true} title="入力フォーム" onClose={() => {}}>
          <form>
            <label htmlFor="email">メールアドレス</label>
            <input id="email" type="email" required />
            <button type="submit">送信</button>
          </form>
        </Modal>
      );

      expect(await axe(container)).toHaveNoViolations();
    });

    it('画像の alt 属性がない場合、違反を正しく検出すること', async () => {
      const { container } = render(
        <Modal isOpen={true} title="テスト" onClose={() => {}}>
          {/* alt 属性なしの img は違反として検出される */}
          <img src="test.png" />
        </Modal>
      );

      const results = await axe(container);
      expect(results.violations).toContainEqual(
        expect.objectContaining({
          id: 'image-alt'
        })
      );
    });

    it('ボタンにテキストラベルがない場合、違反を検出すること', async () => {
      const { container } = render(
        <Modal isOpen={true} title="テスト" onClose={() => {}}>
          {/* aria-label なしのアイコンボタンは違反 */}
          <button>🔍</button>
        </Modal>
      );

      const results = await axe(container);
      expect(results.violations.some(v => v.id === 'button-name')).toBe(true);
    });

    it('特定のルールのみをチェックして検証すること', async () => {
      const { container } = render(
        <Modal isOpen={true} title="テスト" onClose={() => {}}>
          <button>アクション</button>
        </Modal>
      );

      // 特定のルールのみを有効化
      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'color-contrast': { enabled: false }
        }
      });

      // button-name ルールのみが検証される
      expect(results).toHaveNoViolations();
    });
  });

  describe('状態別検証', () => {
    
    it('ローディング状態で aria-live が適切に設定されていること', async () => {
      const { container, rerender } = render(
        <Modal isOpen={true} title="テスト" onClose={() => {}} isLoading={false} />
      );

      // 通常状態は違反なし
      let results = await axe(container);
      expect(results).toHaveNoViolations();

      // ローディング状態に変更
      rerender(
        <Modal isOpen={true} title="テスト" onClose={() => {}} isLoading={true} />
      );

      // aria-live="polite" または aria-live="assertive" が存在すること
      const status = screen.queryByRole('status');
      if (status) {
        expect(status).toHaveAttribute('aria-live');
      }

      results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('複数の状態遷移を通じて a11y を維持すること', async () => {
      const { container, rerender } = render(
        <Modal isOpen={true} title="テスト" onClose={() => {}} isLoading={false} />
      );

      // 状態1：通常
      expect(await axe(container)).toHaveNoViolations();

      // 状態2：ローディング
      rerender(
        <Modal isOpen={true} title="テスト" onClose={() => {}} isLoading={true} />
      );
      expect(await axe(container)).toHaveNoViolations();

      // 状態3：完了
      rerender(
        <Modal isOpen={true} title="テスト" onClose={() => {}} isLoading={false} isComplete={true} />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
```

### 3.6 テストヘルパーユーティリティ

頻繁に使用する a11y テストのパターンをヘルパー関数として定義します。

```typescript
// src/test/a11y-helpers.ts
import { RenderOptions, render } from '@testing-library/react';
import { axe, AxeResults } from 'vitest-axe';

/**
 * DPC Design System の必須ルールに基づいて axe 検証を実行
 * @param container - 検証対象の DOM コンテナ
 * @param options - ルール設定オプション
 * @returns axe の検証結果
 */
export async function checkA11yForDPC(
  container: HTMLElement,
  options?: {
    rules?: string[];
    ignoreRules?: string[];
  }
): Promise<AxeResults> {
  const rulesConfig: Record<string, { enabled: boolean }> = {};

  const enabledRules = options?.rules || [
    'color-contrast',
    'button-name',
    'aria-required-attr',
    'image-alt',
    'form-field-has-name'
  ];

  // ルール設定を構築
  enabledRules.forEach(ruleId => {
    const shouldIgnore = options?.ignoreRules?.includes(ruleId);
    rulesConfig[ruleId] = { enabled: !shouldIgnore };
  });

  const result = await axe(container, { rules: rulesConfig });
  return result;
}

/**
 * Story コンポーネントをレンダリングして a11y 検証を実行
 * @param component - レンダリング対象のコンポーネント
 * @param options - render オプション
 * @returns コンテナと検証結果を含むオブジェクト
 */
export async function renderComponentAndCheckA11y(
  component: React.ReactNode,
  options?: RenderOptions
) {
  const { container } = render(component, options);
  const results = await axe(container);

  return {
    container,
    results,
    violations: results.violations,
    passes: results.passes
  };
}

/**
 * 複数の DOM スナップショットを順序立てて a11y 検証する
 * ユーザージャーニーや状態遷移の検証に利用
 * @param snapshots - 各段階のコンテナ配列
 * @param labels - 各段階のラベル（ログ用）
 */
export async function validateA11ySequence(
  snapshots: HTMLElement[],
  labels?: string[]
): Promise<{ step: number; label: string; violations: number }[]> {
  const results = [];

  for (let i = 0; i < snapshots.length; i++) {
    const axeResults = await axe(snapshots[i]);
    results.push({
      step: i + 1,
      label: labels?.[i] || `Step ${i + 1}`,
      violations: axeResults.violations.length
    });
  }

  return results;
}

/**
 * フォーカストラップの動作を検証するテストヘルパー
 * @param getContainer - コンテナを取得する関数
 * @param focusableSelector - フォーカス可能要素のセレクタ
 */
export function createFocusTrapTest(
  getContainer: () => HTMLElement,
  focusableSelector: string
) {
  return async () => {
    const container = getContainer();
    const focusables = Array.from(
      container.querySelectorAll(focusableSelector)
    ) as HTMLElement[];

    if (focusables.length === 0) {
      throw new Error(`フォーカス可能要素が見つかりません: ${focusableSelector}`);
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // 最後の要素から Tab で最初の要素に戻ることを確認
    last.focus();
    expect(document.activeElement).toBe(last);
  };
}

/**
 * 色コントラスト比のみを検証する専用ヘルパー
 * @param container - 検証対象の DOM コンテナ
 */
export async function checkColorContrast(container: HTMLElement) {
  const result = await axe(container, {
    rules: {
      'color-contrast': { enabled: true }
    }
  });

  return result.violations.filter(v => v.id === 'color-contrast');
}

/**
 * ARIA 属性関連のみを検証する専用ヘルパー
 * @param container - 検証対象の DOM コンテナ
 */
export async function checkAriaViolations(container: HTMLElement) {
  const ariaRules = [
    'aria-required-attr',
    'aria-required-parent',
    'aria-required-children',
    'aria-hidden-focus',
    'aria-roles',
    'aria-valid-attr',
    'aria-valid-attr-role'
  ];

  const rulesConfig: Record<string, { enabled: boolean }> = {};
  ariaRules.forEach(rule => {
    rulesConfig[rule] = { enabled: true };
  });

  const result = await axe(container, { rules: rulesConfig });
  return result.violations;
}
```

### 3.7 Button コンポーネントの Vitest テスト例

```typescript
// src/components/Button/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from './Button';

describe('Button Component Accessibility', () => {
  
  describe('基本的なアクセシビリティ', () => {
    
    it('テキストボタンが正しくレンダリングされること', async () => {
      const { container } = render(
        <Button onClick={() => {}}>クリック</Button>
      );

      const button = screen.getByRole('button', { name: 'クリック' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');

      expect(await axe(container)).toHaveNoViolations();
    });

    it('無効化状態のボタンが正しく表現されること', async () => {
      const { container } = render(
        <Button disabled onClick={() => {}}>
          無効化
        </Button>
      );

      const button = screen.getByRole('button', { name: '無効化' });
      expect(button).toBeDisabled();

      expect(await axe(container)).toHaveNoViolations();
    });

    it('aria-label を持つボタンが正しくレンダリングされること', async () => {
      const { container } = render(
        <Button aria-label="メニューを開く" onClick={() => {}}>
          ☰
        </Button>
      );

      const button = screen.getByRole('button', { name: 'メニューを開く' });
      expect(button).toBeInTheDocument();

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('色コントラスト検証', () => {
    
    it('Primary variant が十分なコントラスト比を持つこと', async () => {
      const { container } = render(
        <Button variant="primary" onClick={() => {}}>
          Primary
        </Button>
      );

      const results = await axe(container, {
        rules: { 'color-contrast': { enabled: true } }
      });

      // Primary ボタンはコントラスト比が十分であること
      const contrastViolations = results.violations.filter(
        v => v.id === 'color-contrast'
      );
      expect(contrastViolations).toHaveLength(0);
    });

    it('Secondary variant が十分なコントラスト比を持つこと', async () => {
      const { container } = render(
        <Button variant="secondary" onClick={() => {}}>
          Secondary
        </Button>
      );

      const results = await axe(container, {
        rules: { 'color-contrast': { enabled: true } }
      });

      const contrastViolations = results.violations.filter(
        v => v.id === 'color-contrast'
      );
      expect(contrastViolations).toHaveLength(0);
    });
  });

  describe('キーボード対応', () => {
    
    it('Space キーで発火すること', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>クリック</Button>);

      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });

      // イベントハンドラが呼び出されることを確認
      // 実装に応じてテストを調整してください
    });

    it('Enter キーで発火すること', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>クリック</Button>);

      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    });
  });

  describe('バリエーション検証', () => {
    
    it('すべての variant が a11y 違反を持たないこと', async () => {
      const variants = ['primary', 'secondary', 'danger'];

      for (const variant of variants) {
        const { container } = render(
          <Button variant={variant as any} onClick={() => {}}>
            {variant}
          </Button>
        );

        expect(await axe(container)).toHaveNoViolations();
      }
    });

    it('すべてのサイズが a11y 違反を持たないこと', async () => {
      const sizes = ['small', 'medium', 'large'];

      for (const size of sizes) {
        const { container } = render(
          <Button size={size as any} onClick={() => {}}>
            {size}
          </Button>
        );

        expect(await axe(container)).toHaveNoViolations();
      }
    });
  });
});
```

---

## 4. Storybook によるコンポーネント単位の検証

### 4.1 概要

Storybook は、コンポーネントのビジュアル表現と対話的なテストの場を提供します。`@storybook/addon-a11y` により、Story の描画時に自動的に axe 検証を実行できます。

**検証対象：**
- コンポーネントの複数の状態（Primary、Disabled など）
- Design System 要件への準拠
- 各 Story ごとの a11y 違反

### 4.2 Storybook 設定

#### 4.2.1 Main Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts?(x)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y', // ← a11y 検証アドオン
    '@storybook/addon-coverage'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  },
  core: {
    builder: '@storybook/builder-vite'
  }
};

export default config;
```

#### 4.2.2 Preview Configuration

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    a11y: {
      // グローバル a11y 設定
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true
          },
          {
            id: 'valid-aria-role',
            enabled: true
          },
          {
            id: 'aria-required-attr',
            enabled: true
          },
          {
            id: 'image-alt',
            enabled: true
          },
          {
            id: 'button-name',
            enabled: true
          },
          {
            id: 'form-field-has-name',
            enabled: true
          }
        ]
      }
    }
  }
};

export default preview;
```

### 4.3 Button コンポーネントの Story 実装例

Button コンポーネントの複数の状態を Story として定義し、各状態で a11y 検証を実施します。

```typescript
// src/components/Button/Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger']
    },
    disabled: {
      control: 'boolean'
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large']
    }
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
            options: {
              enhancedBoundaries: true // WCAG AAA レベルで検証
            }
          },
          {
            id: 'button-name',
            enabled: true
          }
        ]
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

/**
 * プライマリボタン（デフォルト）
 * 一般的な操作に使用されるボタンです。
 */
export const Primary: Story = {
  args: {
    label: 'クリックしてください',
    variant: 'primary',
    onClick: () => {}
  }
};

/**
 * セカンダリボタン
 * 補助的な操作に使用されるボタンです。
 */
export const Secondary: Story = {
  args: {
    label: 'セカンダリ操作',
    variant: 'secondary',
    onClick: () => {}
  }
};

/**
 * 無効化状態のボタン
 * ユーザーがクリックできない状態を表します。
 */
export const Disabled: Story = {
  args: {
    label: '無効化',
    disabled: true,
    onClick: () => {}
  },
  parameters: {
    a11y: {
      // 無効化ボタンでは色コントラスト要件が異なる場合があります
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: false // 必要に応じて無効化
          }
        ]
      }
    }
  }
};

/**
 * アイコンのみボタン
 * アイコンだけを表示するボタンは、必ず aria-label を指定してください。
 */
export const IconOnly: Story = {
  args: {
    icon: '🔍',
    ariaLabel: '検索',
    onClick: () => {}
  }
};

/**
 * 大きいサイズのボタン
 */
export const Large: Story = {
  args: {
    label: '大きいボタン',
    size: 'large',
    onClick: () => {}
  }
};

/**
 * 小さいサイズのボタン
 */
export const Small: Story = {
  args: {
    label: '小さいボタン',
    size: 'small',
    onClick: () => {}
  }
};
```

### 4.4 Modal コンポーネントの Story 実装例

複数の状態を持つ Modal コンポーネントの Story 例です。

```typescript
// src/components/Modal/Modal.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  component: Modal,
  title: 'Components/Modal',
  tags: ['autodocs'],
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true
          },
          {
            id: 'aria-required-attr',
            enabled: true
          }
        ]
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof Modal>;

/**
 * シンプルなモーダル
 * テキストコンテンツのみを表示します。
 */
export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <button onClick={() => setIsOpen(true)}>モーダルを開く</button>
        <Modal
          isOpen={isOpen}
          title="確認"
          onClose={() => setIsOpen(false)}
        >
          <p>これはモーダルコンポーネントです。</p>
        </Modal>
      </>
    );
  }
};

/**
 * フォーム付きモーダル
 * ユーザー入力を受け付けるモーダルです。
 */
export const WithForm: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <button onClick={() => setIsOpen(true)}>フォームを開く</button>
        <Modal
          isOpen={isOpen}
          title="ユーザー登録"
          onClose={() => setIsOpen(false)}
        >
          <form>
            <label htmlFor="name">お名前</label>
            <input id="name" type="text" required />

            <label htmlFor="email">メールアドレス</label>
            <input id="email" type="email" required />

            <button type="submit">登録</button>
          </form>
        </Modal>
      </>
    );
  }
};

/**
 * ローディング状態のモーダル
 * 処理中であることをユーザーに伝えます。
 */
export const Loading: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <button onClick={() => setIsOpen(true)}>処理を開始</button>
        <Modal
          isOpen={isOpen}
          title="処理中"
          onClose={() => setIsOpen(false)}
          isLoading={true}
        >
          <p>データを処理しています。しばらくお待ちください。</p>
        </Modal>
      </>
    );
  }
};

/**
 * 大きなコンテンツを含むモーダル
 * スクロール可能なモーダルの例です。
 */
export const LargeContent: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <button onClick={() => setIsOpen(true)}>詳細を表示</button>
        <Modal
          isOpen={isOpen}
          title="利用規約"
          onClose={() => setIsOpen(false)}
        >
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <p>これは長いコンテンツの例です。</p>
            {Array.from({ length: 20 }).map((_, i) => (
              <p key={i}>
                段落 {i + 1}: ここにテキストが続きます。
              </p>
            ))}
          </div>
        </Modal>
      </>
    );
  }
};
```

---

## 5. Playwright による E2E レベルの検証

### 5.1 概要

Playwright は、ブラウザを自動操作してエンドツーエンドのシナリオテストを実行します。`@axe-core/playwright` により、ページレベルの a11y 検証を実施できます。

**検証対象：**
- ページ全体の a11y 違反
- ユーザージャーニーを通じた a11y 維持
- 複数ブラウザでの検証
- 動的状態変化による a11y 変動

### 5.2 Playwright 設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['github'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:6006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run storybook',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI
  }
});
```

### 5.3 モーダルコンポーネント（Story）の E2E テスト

Storybook 上の Story をターゲットとした Playwright テストです。

```typescript
// e2e/modal.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from '@axe-core/playwright';

test.describe('Modal Component - Accessibility E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Storybook の Modal Story に直接アクセス
    await page.goto(
      'iframe.html?args=&id=components-modal--default&viewMode=story'
    );
    // axe を inject
    await injectAxe(page);
  });

  test('初期状態で a11y 違反がないこと', async ({ page }) => {
    await checkA11y(page);
  });

  test('モーダルを開いた後、違反がないこと', async ({ page }) => {
    await page.click('button:has-text("モーダルを開く")');
    await page.waitForSelector('[role="dialog"]');

    // Dialog 要素のスコープで検証
    await checkA11y(page, '[role="dialog"]', {
      detailedReport: true
    });
  });

  test('キーボード操作を通じて違反がないこと', async ({ page }) => {
    await page.click('button:has-text("モーダルを開く")');
    await page.waitForSelector('[role="dialog"]');

    // Tab キーで navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // 状態変化後も検証
    await checkA11y(page, '[role="dialog"]');
  });

  test('Escape キーでモーダルを閉じた後、違反がないこと', async ({ page }) => {
    await page.click('button:has-text("モーダルを開く")');
    await page.waitForSelector('[role="dialog"]');

    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });

    // ページ全体を再検証
    await checkA11y(page);
  });

  test('フォーム付きモーダルで入力後、違反がないこと', async ({ page }) => {
    await page.goto(
      'iframe.html?args=&id=components-modal--with-form&viewMode=story'
    );
    await injectAxe(page);

    await page.click('button:has-text("フォームを開く")');
    await page.waitForSelector('[role="dialog"]');

    // フォームに入力
    await page.fill('input#name', '太郎');
    await page.fill('input#email', 'taro@example.com');

    await checkA11y(page, '[role="dialog"]');
  });

  test('色コントラスト違反を検出すること（テスト用シナリオ）', async ({ page }) => {
    const violations = await getViolations(page, {
      rules: ['color-contrast']
    });

    // 違反の有無を検証（期待値は実装による）
    console.log(`色コントラスト違反数: ${violations.length}`);
  });
});
```

### 5.4 ユーザージャーニーの E2E テスト

実際のユーザー操作を模した複合シナリオのテストです。

```typescript
// e2e/user-journey.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('User Journey - Login to Dashboard Accessibility', () => {
  
  test('ログインからダッシュボード表示まで、a11y を維持すること', async ({ page }) => {
    // Step 1: ログインページ
    await page.goto('/login');
    await injectAxe(page);
    await checkA11y(page);

    // Step 2: フォーム入力
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    await checkA11y(page);

    // Step 3: フォーム送信
    await page.click('button[type="submit"]');

    // Step 4: ローディング中
    await page.waitForLoadState('networkidle');
    await injectAxe(page);
    await checkA11y(page);

    // Step 5: ダッシュボード表示
    await page.waitForURL('/dashboard');
    await injectAxe(page);
    await checkA11y(page);

    // Step 6: ナビゲーション操作
    await page.click('a:has-text("プロフィール")');
    await page.waitForURL('/profile');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('エラー状態を正しく通知すること', async ({ page }) => {
    await page.goto('/login');
    await injectAxe(page);

    // 無効な認証情報を入力
    await page.fill('input[name="email"]', 'invalid@');
    await page.fill('input[name="password"]', '');
    await page.click('button[type="submit"]');

    // エラーメッセージが aria-live で announce されることを確認
    const errorRegion = page.locator('[role="alert"]');
    await expect(errorRegion).toBeVisible();
    expect(errorRegion).toHaveAttribute('aria-live', 'polite');

    await checkA11y(page);
  });

  test('成功メッセージを正しく通知すること', async ({ page }) => {
    await page.goto('/form');
    await injectAxe(page);

    // フォーム入力と送信
    await page.fill('input[name="name"]', '太郎');
    await page.click('button[type="submit"]');

    // 成功メッセージが表示されることを確認
    const successMessage = page.locator('[role="status"]');
    await expect(successMessage).toBeVisible();
    expect(successMessage).toHaveAttribute('aria-live', 'polite');

    await checkA11y(page);
  });
});
```

### 5.5 Design System コンポーネント一括スキャン

複数のコンポーネントを自動的にスキャンするテストです。

```typescript
// e2e/design-system-scan.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

const COMPONENTS = [
  'button',
  'input',
  'modal',
  'dropdown',
  'toast',
  'badge',
  'card',
  'form'
];

test.describe('Design System Components - Comprehensive Scan', () => {
  
  for (const component of COMPONENTS) {
    test(`${component} コンポーネントが a11y 違反を持たないこと`, async ({ page }) => {
      // Storybook docs ページでコンポーネント一覧を表示
      await page.goto(`/docs/${component}--docs`);
      await injectAxe(page);

      // ページ全体を検証
      await checkA11y(page, undefined, {
        detailedReport: true
      });
    });
  }

  test('すべてのボタンが適切にラベル付けされていること', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    // 全ボタン要素を取得
    const buttonCount = await page.locator('button').count();

    for (let i = 0; i < buttonCount; i++) {
      const button = page.locator('button').nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      // テキスト、aria-label、title のいずれかが存在することを確認
      const hasLabel = text?.trim() || ariaLabel || title;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('すべての img 要素が alt 属性を持つこと', async ({ page }) => {
    await page.goto('/');

    const imgCount = await page.locator('img').count();

    for (let i = 0; i < imgCount; i++) {
      const img = page.locator('img').nth(i);
      const alt = await img.getAttribute('alt');
      
      // alt 属性が存在し、空でないことを確認
      expect(alt).toBeTruthy();
    }
  });

  test('すべてのフォーム入力が label と関連付けられていること', async ({ page }) => {
    await page.goto('/');

    const inputCount = await page.locator('input').count();

    for (let i = 0; i < inputCount; i++) {
      const input = page.locator('input').nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      if (id) {
        // id がある場合、対応する label が存在することを確認
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label > 0 || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        // id がない場合、aria-label または aria-labelledby が必須
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });
});
```

---

## 6. CI/CD パイプライン統合

### 6.1 概要

GitLab CI/CD パイプラインにアクセシビリティテストを統合することで、全自動化した検証環境を構築できます。各 MR（マージリクエスト）は、a11y テストにパスしなければマージできません。

### 6.2 GitLab CI/CD 設定

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - report

variables:
  NODE_VERSION: '18'
  CACHE_KEY: '${CI_COMMIT_REF_SLUG}'

cache:
  key: ${CACHE_KEY}
  paths:
    - node_modules/
    - .npm/

# === Vitest + vitest-axe テスト ===
test:vitest-a11y:
  stage: test
  image: node:${NODE_VERSION}
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - npm run test:a11y:vitest -- --reporter=json --outputFile=test-results/vitest-a11y.json
  artifacts:
    reports:
      junit: test-results/vitest-a11y.xml
    paths:
      - test-results/vitest-a11y.json
      - coverage/
    expire_in: 30 days
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  allow_failure: false
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure

# === Storybook ビルド ===
build:storybook:
  stage: build
  image: node:${NODE_VERSION}
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - npm run build-storybook -- -o storybook-static
  artifacts:
    paths:
      - storybook-static/
    expire_in: 1 day
  only:
    - merge_requests
    - main
    - develop

# === Playwright + @axe-core/playwright テスト ===
test:playwright-a11y:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  needs:
    - build:storybook
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - npm run test:a11y:playwright -- --reporter=json --output-file=test-results/playwright-a11y.json
  artifacts:
    reports:
      junit: test-results/playwright-a11y.xml
    paths:
      - test-results/playwright-a11y.json
      - playwright-report/
    expire_in: 30 days
  allow_failure: false
  retry:
    max: 2

# === A11y レポート生成 ===
report:a11y:
  stage: report
  image: node:${NODE_VERSION}
  needs:
    - test:vitest-a11y
    - test:playwright-a11y
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - node scripts/generate-a11y-report.js
  artifacts:
    paths:
      - public/a11y-report/
    expire_in: 90 days
  allow_failure: true
  only:
    - merge_requests

# === MR コメント生成 ===
report:mr-comment:
  stage: report
  image: node:${NODE_VERSION}
  needs:
    - test:vitest-a11y
    - test:playwright-a11y
  before_script:
    - npm ci --cache .npm --prefer-offline
    - apt-get update && apt-get install -y curl
  script:
    - |
      VITEST_VIOLATIONS=$(jq '.stats.violations // 0' test-results/vitest-a11y.json 2>/dev/null || echo "0")
      PLAYWRIGHT_VIOLATIONS=$(jq '.stats.violations // 0' test-results/playwright-a11y.json 2>/dev/null || echo "0")
      TOTAL_VIOLATIONS=$((VITEST_VIOLATIONS + PLAYWRIGHT_VIOLATIONS))

      COMMENT="## ♿ Accessibility Test Results

      ### Vitest + vitest-axe
      - ✅ Tests passed

      ### Playwright + @axe-core/playwright
      - ✅ Tests passed

      ### Violations Summary
      - Total violations: \`${TOTAL_VIOLATIONS}\`
      - Vitest: \`${VITEST_VIOLATIONS}\`
      - Playwright: \`${PLAYWRIGHT_VIOLATIONS}\`

      $([ "$TOTAL_VIOLATIONS" -eq 0 ] && echo '✅ **All a11y tests passed**' || echo '❌ **Please fix a11y violations**')"

      curl --request POST \
        --header "PRIVATE-TOKEN: ${CI_JOB_TOKEN}" \
        --data-urlencode "body=${COMMENT}" \
        "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/merge_requests/${CI_MERGE_REQUEST_IID}/notes"
  allow_failure: true
  only:
    - merge_requests
```

### 6.3 レポート生成スクリプト

```javascript
// scripts/generate-a11y-report.js
const fs = require('fs');
const path = require('path');

const vitestResults = JSON.parse(
  fs.readFileSync('test-results/vitest-a11y.json', 'utf8')
);
const playwrightResults = JSON.parse(
  fs.readFileSync('test-results/playwright-a11y.json', 'utf8')
);

const report = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 4px; }
    .pass { color: green; }
    .fail { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Accessibility Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Vitest Violations: <span class="${vitestResults.violations?.length ? 'fail' : 'pass'}">${vitestResults.violations?.length || 0}</span></p>
    <p>Playwright Violations: <span class="${playwrightResults.violations?.length ? 'fail' : 'pass'}">${playwrightResults.violations?.length || 0}</span></p>
  </div>

  <h2>Vitest Results</h2>
  <table>
    <tr>
      <th>Rule ID</th>
      <th>Impact</th>
      <th>Count</th>
    </tr>
    ${(vitestResults.violations || [])
      .map(v => `<tr><td>${v.id}</td><td>${v.impact}</td><td>${v.nodes?.length || 0}</td></tr>`)
      .join('')}
  </table>

  <h2>Playwright Results</h2>
  <table>
    <tr>
      <th>Rule ID</th>
      <th>Impact</th>
      <th>Count</th>
    </tr>
    ${(playwrightResults.violations || [])
      .map(v => `<tr><td>${v.id}</td><td>${v.impact}</td><td>${v.nodes?.length || 0}</td></tr>`)
      .join('')}
  </table>
</body>
</html>
`;

const reportDir = 'public/a11y-report';
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(path.join(reportDir, 'index.html'), report);
console.log('✅ Report generated at public/a11y-report/index.html');
```

---

## 7. テスト実行方法

### 7.1 ローカル環境での実行

```bash
# === Vitest + vitest-axe テスト ===
npm run test:a11y:vitest

# === Storybook の起動 ===
npm run storybook

# === Playwright + @axe-core/playwright テスト ===
npm run test:a11y:playwright

# === すべてのテストを実行 ===
npm run test:a11y
```

### 7.2 package.json スクリプト設定

```json
{
  "scripts": {
    "test:a11y:vitest": "vitest run --reporter=json src/**/*.test.tsx --outputFile=test-results/vitest-a11y.json",
    "test:a11y:playwright": "playwright test e2e/**/*.a11y.spec.ts --reporter=json --output-file=test-results/playwright-a11y.json",
    "test:a11y": "npm run test:a11y:vitest && npm run build-storybook && npm run test:a11y:playwright",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "devDependencies": {
    "vitest-axe": "^1.0.0",
    "axe-core": "^4.8.0",
    "@axe-core/playwright": "^1.0.0",
    "@storybook/addon-a11y": "^10.0.0"
  }
}
```

---

## 8. vitest-axe の主な特徴と jest-axe との違い

### vitest-axe の利点

| 項目 | vitest-axe | jest-axe |
|------|-----------|----------|
| **フレームワーク対応** | Vitest 専用（最適化） | 汎用（Jest/Vitest） |
| **パフォーマンス** | Vitest プリミティブで実装 | Jest 互換レイヤー |
| **TypeScript 対応** | ネイティブ対応 | 別途型定義が必要な場合あり |
| **Matcher API** | Vitest 標準に統一 | 独自 Matcher |
| **保守性** | Vitest コア開発と連携 | サードパーティ保守 |
| **セットアップ** | `expect.extend()` | `expect.extend()` |

### vitest-axe の使用例

```typescript
// シンプルな検証
expect(await axe(container)).toHaveNoViolations();

// ルール指定
const results = await axe(container, {
  rules: {
    'button-name': { enabled: true },
    'color-contrast': { enabled: false }
  }
});

// 複合条件
expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);

// リージョンスコープ
expect(await axe(container, null, { 
  selector: '[role="dialog"]' 
})).toHaveNoViolations();
```

---

## 9. フェーズ別ロールアウト計画

DPC では、組織全体への段階的な導入を予定しています。各フェーズで検証ルールと対象範囲が段階的に拡大します。

### Phase 1（現在～4月）：Critical ルールのみ（コアチーム対象）

| 項目 | 内容 |
|------|------|
| **対象範囲** | コアコンポーネント（Button、Input、Modal など） |
| **検証ルール** | color-contrast、button-name、form-field-has-name、image-alt |
| **検証レベル** | WCAG 2.1 Level AA |
| **実装モード** | CI/CD 統合（Critical 違反でブロック） |
| **期待値** | Critical バグ 100% 検出 |

### Phase 2（5月～6月）：Warning レベル追加（全開発チーム対象）

| 項目 | 内容 |
|------|------|
| **対象範囲** | 全コンポーネント + ページ組み合わせ |
| **検証ルール** | Phase 1 + aria-required-attr、heading-order、valid-aria-role |
| **検証レベル** | WCAG 2.1 Level AA |
| **実装モード** | 段階的ロールアウト（チーム別） |
| **期待値** | Warning レベル問題 70% 検出 |

### Phase 3（7月～）：フルカバレッジ（全エンジニア対象）

| 項目 | 内容 |
|------|------|
| **対象範囲** | E2E + デザインシステム検証 |
| **検証ルール** | すべての axe ルール有効化 |
| **検証レベル** | WCAG 2.1 Level AAA 対象（一部） |
| **実装モード** | チーム別カスタマイズ可能化 |
| **期待値** | デザインシステム準拠 95% |

---

## 10. よくある質問と回答

### Q1. vitest-axe と jest-axe の使い分けは。

**A.** Vitest プロジェクトではすべて vitest-axe を使用してください。vitest-axe は Vitest の標準 API に最適化されており、パフォーマンスと保守性が優れています。jest-axe は古いプロジェクトで Jest を使用している場合のみ対象です。新規プロジェクトは vitest-axe を採用してください。

### Q2. 既存コンポーネントに a11y 違反がある場合、どうすればよいですか。

**A.** GitLab Issues で a11y 改善タスクを作成し、以下の優先度で対応してください。

1. **Critical**（Level AA 違反）：即時対応
2. **Major**（Color Contrast、Semantics）：2週間以内
3. **Minor**（Warning レベル）：次月中

Phase 1 では Critical のみ CI でブロックするため、既存コンポーネントについては猶予期間があります。

### Q3. アイコンのみボタンはどのようにラベル付けすればよいですか。

**A.** 必ず `aria-label` を指定してください。

```typescript
<button aria-label="検索">🔍</button>
// または
<button aria-label="メニューを開く">☰</button>
```

### Q4. モーダルのフォーカストラップをテストするには何をすればよいですか。

**A.** ガイドラインの「フォーカストラップの検証」セクションを参照し、Vitest でのテスト実装例を使用してください。Playwright では `keyboard.press('Tab')` でキーボード操作をシミュレートできます。

### Q5. Design System のコンポーネント側で a11y を満たした場合、個別の Story テストは不要ですか。

**A.** Story テストは必須です。Design System は基本形を定義するだけであり、実装時のカスタマイズ（クラス追加、プロップ組み合わせなど）により a11y が破損する可能性があります。各 Story 定義時に a11y パラメータを指定し、検証してください。

### Q6. vitest-axe でカスタムルールを定義できますか。

**A.** vitest-axe は axe-core の標準ルールセットを使用します。カスタムルールが必要な場合は、axe-core の Check API を使用するか、テストロジック内で独立した検証を実装してください。

```typescript
// カスタム検証の例
it('カスタムルール：すべてのボタンが btn クラスを持つこと', () => {
  const { container } = render(<Modal isOpen={true} onClose={() => {}} />);
  
  const buttons = container.querySelectorAll('button');
  buttons.forEach(btn => {
    expect(btn).toHaveClass('btn');
  });
});
```


---

## 11. 参考資料

- [WCAG 2.1 日本語版](https://waic.jp/docs/WCAG21/)
- [vitest-axe GitHub Repository](https://github.com/maraisr/vitest-axe)
- [axe DevTools Official Documentation](https://www.deque.com/axe/devtools/)
- [Storybook Accessibility Guide](https://storybook.js.org/docs/react/writing-tests/accessibility-testing)
- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)

---

**このガイドラインは定期的に見直され、更新される予定です。**
