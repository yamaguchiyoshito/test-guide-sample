# Logging Guide

## 目的
- `apps/web` のログを構造化し、`requestId` でクライアント送信ログと API Route ログを突合できる状態を維持する。
- `email/password/token` などの機微情報をログへ平文出力しない。

## ログレベル制御
- server runtime: `LOG_LEVEL`
- client runtime: `NEXT_PUBLIC_LOG_LEVEL`
- 許可値: `debug`, `info`, `warn`, `error`

デフォルト:
- `NODE_ENV=development`: `debug`
- `NODE_ENV=test`: `warn`
- `NODE_ENV=production`: `info`

## 出力フォーマット
- `NODE_ENV=development`: `[api] message` + context
- それ以外: 1行 JSON

JSON固定キー:
- `timestamp`
- `level`
- `message`
- `event`
- `runtime`
- `context`

## 相関ID
- ヘッダキーは `X-Correlation-ID`。
- API Route は `resolveRequestId(request)` でヘッダを優先採用し、空の場合は新規発行する。
- client environment ログは payload に `requestId` を必須で含め、fetch transport では同値を `X-Correlation-ID` として送信する。

## イベント名一覧
- `http.client.request.succeeded`
- `http.client.request.retry`
- `http.client.request.failed`
- `client.environment.captured`
- `client.environment.sent`
- `client.environment.skipped`
- `api.login.accepted`
- `api.login.rejected`
- `api.csrf.issued`
- `api.csrf.failed`
- `api.client_env.accepted`
- `api.client_env.rejected`
- `api.users.listed`
- `api.users.detail_found`
- `api.users.detail_not_found`

## PIIポリシー
- `sanitizeLogContext` は以下のキーをデフォルト秘匿対象とする:
  - `password`, `passwd`, `secret`, `token`, `apiKey`, `authorization`, `cookie`, `session`, `credential`, `email`
- 秘匿値は `[REDACTED]` へ置換する。
- Login 成功ログに `email` は出力しない。

## 調査手順
1. 障害発生時に `requestId` を取得する。
2. client-side ログで `requestId` と `client.environment.*` を確認する。
3. server-side ログで同じ `requestId` を検索し、`api.*` と `http.client.*` の時系列を確認する。
4. 必要時のみ `LOG_LEVEL=info` から `debug` に引き上げ、調査後は即時戻す。
