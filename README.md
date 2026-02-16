# React Test Guide リポジトリ

このリポジトリは、**React/Next.js + Spring API連携を前提にしたテスト自動化ガイド群**と、`apps/web` の**実行可能な最小サンプル実装**で構成されています。  
テスト戦略はテストピラミッドではなく、**テストトロフィー**を採用しています。

## このリポジトリの役割

- ドキュメント層: テスト設計・運用の標準化
- サンプル実装層: Vitest / Storybook / Playwright / MSW / OpenAPI の実装テンプレート
- API層: 共通HTTPクライアント + ドメインクライアント + React Query の責務分離

## ディレクトリ構成（要点）

```text
test-guide/
├── docs/
│   ├── getting-started.md
│   ├── vitest-guide.md
│   ├── storybook-guide.md
│   ├── playwright-guide.md
│   ├── msw-guide.md
│   ├── factory-pattern.md
│   ├── glossary.md
│   ├── faq.md
│   └── troubleshooting.md
├── common-components.md
├── apps/
│   └── web/                        # 実行可能なNext.jsサンプル
│       ├── src/
│       │   ├── app/                # 画面 + API Route
│       │   ├── api/
│       │   │   ├── core/           # 共通HTTP基盤(ApiError/retry/authなど)
│       │   │   ├── clients/        # ドメイン別APIクライアント
│       │   │   ├── hooks/          # React Queryフック
│       │   │   ├── query/          # QueryClient既定値/Provider
│       │   │   └── contracts.ts    # 生成型の窓口
│       │   ├── tests/              # MSW/Factories/Test setup
│       │   ├── components/         # UserCardサンプル（Story/Test付き）
│       │   └── generated/          # OpenAPI生成物(orval)
│       ├── openapi/                # OpenAPI分割定義(paths/components)
│       ├── openapi.yaml            # ルートOpenAPI
│       ├── docs/api-commonization-plan.md
│       └── package.json
└── packages/
    └── test-utils/                 # 共有テストユーティリティ雛形
```

## ドキュメント索引

- `docs/getting-started.md`  
  全体方針と導入順序
- `docs/vitest-guide.md`  
  Unit/Component/Integration テスト詳細
- `docs/storybook-guide.md`  
  Story/Interaction/A11y
- `docs/playwright-guide.md`  
  E2E設計と運用
- `docs/msw-guide.md`  
  APIモック戦略
- `docs/factory-pattern.md`  
  テストデータ生成
- `common-components.md`  
  共通部品一覧
- `docs/glossary.md`  
  用語集
- `docs/faq.md`  
  FAQ
- `docs/troubleshooting.md`  
  トラブルシューティング
- `apps/web/docs/logging-guide.md`  
  `apps/web` のログレベル・相関ID・PII秘匿ポリシー

## `apps/web` セットアップ

前提:
- Node.js 20系
- pnpm

```bash
cd apps/web
pnpm install
```

## `apps/web` 実行コマンド

```bash
# 開発サーバー
pnpm dev

# 型検査
pnpm type-check

# 単体テスト（Vitest + coverage）
pnpm test:unit

# E2Eテスト（Playwright）
pnpm test:e2e

# Storybook
pnpm storybook

# OpenAPI生成
pnpm openapi:generate

# OpenAPI生成 + 型検査
pnpm openapi:check
```

## サンプルAPIエンドポイント（`apps/web/src/app/api`）

- `POST /api/login`
- `GET /api/users`
- `GET /api/users/{id}`

これらを対象に、`src/api/core/httpClient.ts` と `src/api/clients/*`、`src/api/hooks/*` で通信責務を分離しています。

## OpenAPI運用方針

- ルート仕様: `apps/web/openapi.yaml`
- 分割先:
  - `openapi/paths/*.yaml`
  - `openapi/components/schemas/*.yaml`
  - `openapi/components/headers|parameters|responses|security/*.yaml`
- タグ: `auth`, `users`
- 生成: `orval` (`orval.config.ts`)

## 既知制約（重要）

`orval@7.21.0` では、`components.responses / headers / parameters` の外部参照を強く使うと、生成型で壊れたimportが出るケースがあります。  
現在はビルド安定性を優先し、**スキーマ共通化を有効**、レスポンス共通化は定義を保持しつつ `paths` 側でインライン運用しています。  
詳細は `apps/web/docs/api-commonization-plan.md` を参照してください。

## 推奨の読み進め順

1. `docs/getting-started.md`
2. `common-components.md`
3. `docs/vitest-guide.md` / `docs/storybook-guide.md` / `docs/playwright-guide.md`
4. `docs/msw-guide.md` / `docs/factory-pattern.md`
5. `apps/web` を実行して動作確認
