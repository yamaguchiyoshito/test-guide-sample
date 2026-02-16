# 用語集

## 戦略・品質

| 用語 | 定義 | 主な出典 |
|---|---|---|
| TAS | Test Automation System。テスト自動化の仕組み全体。 | `getting-started.md` |
| TAA | Test Automation Architecture。テスト自動化の設計原則と構造。 | `getting-started.md` |
| TAE | Test Automation Engineer。TASの設計・実装・運用を担う役割。 | `getting-started.md` |
| SUT | System Under Test。テスト対象システム。 | `getting-started.md` |
| テストトロフィー | Static分析を土台に、Integration/Interactionを中心に置くテスト戦略。 | `getting-started.md` `vitest-guide.md` `storybook-guide.md` `playwright-guide.md` |
| Critical Path | 失敗時の事業影響が大きい最重要ユーザーフロー。E2E対象を絞る基準。 | `getting-started.md` `playwright-guide.md` `faq.md` |
| カバレッジ (Coverage) | テストで実行されたコード割合。行・分岐・関数などで計測する。 | `getting-started.md` `vitest-guide.md` `faq.md` |
| カバレッジ閾値 | CIで品質ゲートに使う最低基準。未達時は失敗扱いにする設定。 | `getting-started.md` `vitest-guide.md` |
| Flaky Test | 実装不変でも結果が揺れる不安定テスト。タイミングや状態汚染が主因。 | `getting-started.md` `faq.md` |
| AAAパターン | Arrange-Act-Assert。テストを準備・実行・検証の3段に分ける構造。 | `getting-started.md` `vitest-guide.md` |
| テスト独立性 | テスト同士が状態を共有せず、単体で再現可能な状態を保つ原則。 | `getting-started.md` `vitest-guide.md` `playwright-guide.md` |
| 技術的負債（テスト） | 保守性や信頼性を下げるテスト実装上の負債。定期的に検出・解消する対象。 | `getting-started.md` |

## テスト種別

| 用語 | 定義 | 主な出典 |
|---|---|---|
| Static Analysis | TypeScriptやESLintで実行時前に検証する静的チェック。 | `getting-started.md` |
| Unit Test | 関数や小さなロジック単位を検証するテスト。高速実行が前提。 | `getting-started.md` `vitest-guide.md` |
| Component Test | UIコンポーネント単体の表示・操作・状態変化を検証するテスト。 | `getting-started.md` `vitest-guide.md` |
| Integration Test | 複数コンポーネントやAPI境界をまたぐ連携を検証するテスト。 | `getting-started.md` `vitest-guide.md` |
| Interaction Test | Storybookの`play`関数でユーザー操作を再現して検証するテスト。 | `getting-started.md` `storybook-guide.md` |
| E2E Test | 実ブラウザで業務フローを通し検証するテスト。 | `getting-started.md` `playwright-guide.md` |
| VRT | Visual Regression Test。スクリーンショット差分でUI崩れを検出するテスト。 | `getting-started.md` `storybook-guide.md` `playwright-guide.md` |
| A11y Test | アクセシビリティ基準（WCAG）を自動検証するテスト。 | `getting-started.md` `storybook-guide.md` |
| Contract Test | API仕様（OpenAPI）との整合を確認する契約ベースの検証。 | `getting-started.md` |

## ツール・ライブラリ

| 用語 | 定義 | 主な出典 |
|---|---|---|
| Vitest | Vite系エコシステムと親和性が高いTypeScript対応テストランナー。 | `getting-started.md` `vitest-guide.md` |
| Playwright | Chromium/Firefox/WebKitを横断できるE2E自動化フレームワーク。 | `getting-started.md` `playwright-guide.md` |
| Storybook | UI部品の開発・可視化・ドキュメント化・Interactionテスト基盤。 | `getting-started.md` `storybook-guide.md` |
| MSW | Mock Service Worker。HTTP通信を横取りしてAPI応答をモックする仕組み。 | `getting-started.md` `msw-guide.md` |
| Testing Library | ユーザー操作観点でDOMを検証するテストユーティリティ群。 | `getting-started.md` `vitest-guide.md` |
| vitest-axe | `axe-core`を使ってA11y違反を自動検出するVitest統合ツール。 | `getting-started.md` |
| faker.js | 現実的なダミーデータを生成するライブラリ。Seed固定に対応。 | `getting-started.md` `factory-pattern.md` |
| zod | 型安全なスキーマ定義・実行時バリデーションライブラリ。 | `getting-started.md` `factory-pattern.md` `msw-guide.md` |
| orval | OpenAPIからTypeScriptクライアントや型を生成するツール。 | `getting-started.md` |
| jsdom | Node上でブラウザDOM環境を再現するテスト実行環境。 | `vitest-guide.md` |
| happy-dom | jsdom代替として使える高速なDOM実装。 | `vitest-guide.md` |
| GitLab CI | テスト自動実行・成果物管理・品質ゲートを担うCI基盤。 | `getting-started.md` `playwright-guide.md` `storybook-guide.md` |
| GitHub Actions | GitHubリポジトリ上でワークフローを実行するCI/CD基盤。 | `playwright-guide.md` |

## 実装パターン・技術要素

| 用語 | 定義 | 主な出典 |
|---|---|---|
| Page Object Model | 画面操作をクラスに集約してE2Eの保守性を上げる設計パターン。 | `getting-started.md` `playwright-guide.md` `faq.md` |
| Factory Pattern | テストデータ生成を共通化し、再利用性と可読性を高めるパターン。 | `getting-started.md` `factory-pattern.md` `faq.md` |
| Traitパターン | Factoryで「管理者」「無効ユーザー」など属性差分を表現する拡張手法。 | `factory-pattern.md` |
| Handler | MSWで特定エンドポイントの振る舞いを定義する関数。 | `getting-started.md` `msw-guide.md` |
| シナリオハンドラー | 正常系・異常系など用途別に切り替えるMSWハンドラー群。 | `msw-guide.md` |
| Service Worker | ブラウザで通信を中継し、MSWがリクエストを制御する実体。 | `getting-started.md` `msw-guide.md` |
| Locator | Playwrightで要素を安定的に特定するための抽象。 | `playwright-guide.md` |
| セマンティックセレクター | `getByRole`や`getByLabel`のように意味情報で要素取得する方法。 | `playwright-guide.md` `vitest-guide.md` |
| data-testid | セマンティック手段で取れない場合に限定して使う識別属性。 | `playwright-guide.md` `faq.md` |
| 自動待機 (Auto-wait) | 要素可視化や操作可能状態をフレームワークが待機する機能。 | `playwright-guide.md` |
| waitFor | 非同期描画の完了を条件付きで待機するTesting Library API。 | `vitest-guide.md` |
| waitForResponse | Playwrightで特定レスポンス到達を待ってから検証する手法。 | `playwright-guide.md` |
| renderHook | Custom Hookをコンポーネント外で検証するテストヘルパー。 | `vitest-guide.md` |
| vi.fn | 関数モックを生成するVitest API。呼び出し回数や引数を検証可能。 | `vitest-guide.md` |
| vi.mock | モジュール単位で依存を差し替えるVitest API。 | `vitest-guide.md` |
| vi.spyOn | 既存関数を監視して呼び出しを検証するVitest API。 | `vitest-guide.md` |
| setupFiles | テスト起動前に共通初期化を実行するVitest設定。 | `getting-started.md` `vitest-guide.md` |
| storageState | Playwrightで認証状態を保存・再利用する仕組み。 | `playwright-guide.md` |
| Sharding | テスト群を分割して複数ジョブで並列実行する高速化手法。 | `getting-started.md` `playwright-guide.md` |
| retries | 一時的不安定を吸収するための再実行設定。通常はCI限定で利用。 | `getting-started.md` `playwright-guide.md` `faq.md` |
| workers | 並列実行時の実行ワーカー数。速度と安定性のトレードオフを調整する。 | `getting-started.md` `playwright-guide.md` |
| fullyParallel | Playwrightのテストを全面並列化する設定。 | `playwright-guide.md` |
| Trace Viewer | Playwright失敗時の時系列トレースを可視化するデバッグUI。 | `playwright-guide.md` |
| UI Mode | Playwrightの対話的デバッグ実行モード。 | `playwright-guide.md` |
| Story | Storybookで単一状態を表す表示・検証単位。 | `storybook-guide.md` |
| Args | Storybookで状態をパラメータ化する仕組み。 | `storybook-guide.md` |
| ArgTypes | Argsの型・制御UI・ドキュメント表示を定義するメタ情報。 | `storybook-guide.md` |
| Decorator | StorybookのStoryに共通コンテキストを付与するラッパー。 | `storybook-guide.md` |
| Autodocs | Storybookがコンポーネント情報からドキュメントを自動生成する機能。 | `storybook-guide.md` |
| MDX | StorybookドキュメントをMarkdown+JSXで記述する形式。 | `storybook-guide.md` |

## 運用・メトリクス

| 用語 | 定義 | 主な出典 |
|---|---|---|
| E2E成功率 | E2Eの成功件数/総件数。継続運用での安定性指標。 | `getting-started.md` |
| テスト実行時間 | 単体〜E2Eの総実行時間。開発速度に直結する運用指標。 | `getting-started.md` `faq.md` |
| テストコード行数比 | テストコード行数/本番コード行数。保守コスト管理に使う指標。 | `getting-started.md` `faq.md` |
| 故障分析工数 | 失敗テスト1件あたりの原因調査時間。運用効率の主要指標。 | `getting-started.md` |
| Pre-commit Hooks | コミット前にLint/型検査/テストを自動実行する品質ゲート。 | `getting-started.md` |

