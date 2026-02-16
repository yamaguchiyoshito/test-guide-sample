# API共通部品 / OpenAPIタグ化 / 分割計画

## 目的
- HTTP通信の実装揺れを排除し、`fetch`/`axios`直書きを禁止する。
- OpenAPIをドメイン単位で分割し、`tags`で責務境界を固定する。
- 生成コードとアプリ実装の依存点を最小化し、型破綻を防ぐ。

## 結論（採用方針）
1. 共通通信基盤は `src/api/core/*` に集約する。
2. ドメイン通信は `src/api/clients/*Client.ts` に限定する。
3. React Queryは `src/api/hooks/*` に限定する。
4. OpenAPIは `openapi.yaml` をルートに、`openapi/paths/*` と `openapi/components/*` に分割する。
5. `orval` 生成物は `src/generated/*` へ出力し、アプリ側は `src/api/contracts.ts` を唯一の型窓口にする。

## 物理構成
```text
apps/web/
  openapi.yaml
  openapi/
    paths/
      auth.yaml
      users.yaml
    components/
      schemas/
        auth.yaml
        user.yaml
        common.yaml
      headers/common.yaml
      parameters/common.yaml
      responses/common.yaml
      security/schemes.yaml
  src/
    api/
      contracts.ts
      core/
      clients/
      hooks/
      query/
```

## 実行フェーズ

### Phase 1: OpenAPI分割とタグ化
- ルート `openapi.yaml` に `tags` を定義（`auth`, `users`）。
- `paths` を `openapi/paths/*.yaml` へ分離。
- `schemas` を `openapi/components/schemas/*.yaml` へ分離。
- 受け入れ基準:
  - `pnpm run openapi:generate` が成功する。
  - 生成コードの operation が `login`, `listUsers`, `getUserById` で出る。

### Phase 2: API共通部品導入
- `src/api/core/httpClient.ts` を中心に、`apiError`, `auth`, `retry`, `logger`, `requestContext` を共通化。
- `requestJson` でタイムアウト、リトライ、エラー正規化を統一。
- 受け入れ基準:
  - コンポーネント直下に `fetch`/`axios` が存在しない。
  - ApiError経由でエラー判定できる。

### Phase 3: ドメインクライアント + React Query統合
- `authClient`, `userClient` を追加。
- `useLoginMutation`, `useUsersQuery`, `useUserDetailQuery` を追加。
- 画面は hooks のみ利用（`src/app/page.tsx`, `src/app/login/page.tsx`）。
- 受け入れ基準:
  - `pnpm run type-check` 成功。
  - `pnpm run test:unit` 成功。

### Phase 4: 生成安定化
- `orval.config.ts` に `clean: true` を設定し、古い生成残骸を排除。
- `src/api/contracts.ts` を型参照の固定窓口にする。
- 受け入れ基準:
  - `pnpm run openapi:check` が常時成功。

## 制約と回避策（重要）
- `orval@7.21.0` では、外部ファイル化した `components.responses / headers / parameters` を直接参照すると、生成物に壊れた import が混入するケースがある。
- そのため現時点は、**スキーマ共通化は有効化**し、レスポンス共通化は仕様ファイルとして保持しつつ、`paths` ではインライン定義を採用する。
- 将来対応:
  - `orval` を更新して再評価。
  - 問題解消後に `responses/common.yaml` 参照へ戻す。

## 完了判定
- `pnpm run openapi:check` 成功
- `pnpm run test:unit` 成功
- `pnpm run test:e2e` 成功
- 画面側から `fetch`/`axios` の直接呼び出しが消えている
