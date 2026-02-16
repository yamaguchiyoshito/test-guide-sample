# テストガイド索引

## 読む順序

1. `getting-started.md`（全体像と導入手順）
2. `vitest-guide.md`（Unit/Component Test）
3. `storybook-guide.md`（Story/Interaction/A11y）
4. `playwright-guide.md`（E2E）
5. `msw-guide.md`（APIモック）
6. `factory-pattern.md`（テストデータ）
7. `troubleshooting.md`（障害対応）
8. `faq.md`（運用時の判断）
9. `glossary.md`（用語定義）
10. `../apps/web/docs/logging-guide.md`（ログ運用）

## 正本ルール

- 用語定義の正本は `glossary.md` とし、他文書では重複定義しない。
- Story命名は「変数名: 英語PascalCase」「`name`: 日本語」を必須とする。
- `package.json` のテストスクリプト例は `getting-started.md` を正本とする。
- CIジョブ例は `storybook-guide.md` / `playwright-guide.md` を正本とし、他文書は参照リンクで補足する。
