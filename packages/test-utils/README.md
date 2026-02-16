# test-utils

共有テストユーティリティです。`apps/web` から再利用する前提で、以下を提供します。
外部ライブラリ依存は持ち込まず、必要な依存は呼び出し側から注入する設計です。

## 提供ユーティリティ

- `msw/setupTestMsw`
  - Vitest + MSW のライフサイクル (`beforeAll/afterEach/afterAll`) を共通化
- `msw/mockScenario`
  - `MOCK_SCENARIO` の `localStorage` 操作を統一
- `msw/scenarioMatrix`
  - シナリオ別テストケースを自動生成
- `msw/apiClientMock`
  - APIクライアント差し替え用モック生成
- `msw/networkConditionMock`
  - 遅延/失敗/タイムアウトのネットワーク状態を注入
- `react/createTestQueryClient`
  - QueryClient のコンストラクタを注入してテスト用クライアントを生成
- `react/queryCacheSnapshot`
  - Queryキャッシュの差分比較を構造化
- `react/withTestProviders`
  - Providerラッパ関数を合成
- `react/renderWithProviders`
  - render関数とProviderラッパ合成を統一
- `factory/seedFaker`
  - faker seed 固定化（再現性向上）
- `factory/presets`
  - プリセットベースでFactoryデータを合成
- `factory/traits`
  - traitの組み合わせでFactory生成ルールを再利用
- `assertions/apiError`
  - ApiError の `code`/`retryable`/`statusCode`/`retryAfterMs`/`fieldErrors` 検証ヘルパ
- `assertions/httpError`
  - HTTPエラー属性の一括検証ヘルパ
- `assertions/a11y`
  - A11y違反結果の検証・要約ヘルパ
- `retry/retryTestHarness`
  - リトライ判定と待機時間のシミュレーション
- `time/freezeTime`
  - `Date.now()` 固定
- `time/testClock`
  - 時刻の固定 + 経過操作（advance/set/restore）
- `random/fixedRandom`
  - `Math.random()` 固定
- `async/waitForAsyncSettled`
  - 非同期キューの待機処理を標準化
- `contract/validateOpenApiResponse`
  - OpenAPI契約の簡易バリデーション結果を返却
- `metrics/testRunMetrics`
  - テスト実行メトリクスJSON出力の雛形
- `metrics/testMetricsReporter`
  - テストケース一覧から品質レポートを生成/出力

## エントリポイント

- `packages/test-utils/index.ts`
- `packages/test-utils/src/index.ts`

`apps/web` では `@test-utils/*` のパスエイリアス経由で利用します。
