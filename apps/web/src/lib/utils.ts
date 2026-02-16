export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 目的: クエリパラメータを安定した文字列へ変換する。
 * 用途: APIリクエスト時にundefined/null/空配列を除外し、URL組み立てを統一する。
 */
export function toQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      for (const item of value) {
        if (item != null) {
          searchParams.append(key, String(item));
        }
      }
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : '';
}

/**
 * 目的: オブジェクトからundefined値を除去する。
 * 用途: API送信payloadやログ出力時に不要キーを落として差分を安定化する。
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== 'undefined') {
      result[key as keyof T] = value as T[keyof T];
    }
  }

  return result;
}

/**
 * 目的: オブジェクトからnull/undefinedを除去する。
 * 用途: APIヘッダやログコンテキストのノイズを減らし、送信値を最小化する。
 */
export function omitNil<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value !== 'undefined') {
      result[key as keyof T] = value as T[keyof T];
    }
  }

  return result;
}

export type SafeJsonParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

/**
 * 目的: JSONパース失敗を例外ではなく結果オブジェクトで返す。
 * 用途: 外部入力JSONを安全に扱い、呼び出し側で分岐処理しやすくする。
 */
export function safeJsonParse<T>(raw: string): SafeJsonParseResult<T> {
  try {
    const parsed = JSON.parse(raw) as T;
    return { ok: true, data: parsed };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error };
    }
    return { ok: false, error: new Error(String(error)) };
  }
}

/**
 * 目的: JSON文字列化を失敗時フォールバック付きで安全化する。
 * 用途: ログ/ヘッダ等の補助情報で、循環参照などの例外による本処理失敗を防ぐ。
 */
export function safeJsonStringify(value: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
}

/**
 * 目的: unknown例外をログ向けの構造化オブジェクトへ変換する。
 * 用途: logger/telemetryへ安全に載せるため、Error非準拠オブジェクトも正規化する。
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : safeJsonStringify(error, '[unserializable error]'),
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * 目的: unknown例外から表示向けのメッセージ文字列を取得する。
 * 用途: 画面通知やトースト表示で、例外型に依存しないメッセージ出力を統一する。
 */
export function toErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  const message = serializeError(error).message.trim();
  return message.length > 0 ? message : fallback;
}

/**
 * 目的: パラメータ付きパスを安全に組み立てる。
 * 用途: APIクライアントでパスパラメータを一律にエンコードし、URL構築ミスを防ぐ。
 */
export function buildPath(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_all, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

/**
 * 目的: JWTのpayloadを安全にデコードする。
 * 用途: 認証トークンのexpなど、payload情報を読み取る共通処理として利用する。
 */
export function decodeJwtPayload<T extends Record<string, unknown> = Record<string, unknown>>(
  token: string,
): T | null {
  const segments = token.split('.');
  if (segments.length < 2 || !segments[1]) {
    return null;
  }

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = safeJsonParse<T>(decoded);
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * 目的: JWTのexp(claim)をミリ秒に正規化して取得する。
 * 用途: トークン期限切れ判定で秒→ミリ秒変換の重複実装を排除する。
 */
export function getJwtExpMs(token: string): number | null {
  const payload = decodeJwtPayload<{ exp?: unknown }>(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    return null;
  }
  return payload.exp * 1000;
}

/**
 * 目的: Retry-Afterヘッダをミリ秒へ変換する。
 * 用途: 秒指定/HTTP-date指定の両形式を統一し、再試行待機時間として利用する。
 */
export function parseRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  const raw = retryAfterHeader.trim();
  if (raw.length === 0) {
    return undefined;
  }

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const at = Date.parse(raw);
  if (!Number.isNaN(at)) {
    const diff = at - Date.now();
    return diff > 0 ? diff : undefined;
  }

  return undefined;
}

/**
 * 目的: unknown例外が中断エラーかを判定する。
 * 用途: fetch/AbortController由来の中断を通常エラーと分離し、タイムアウト処理へ正規化する。
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { name?: unknown };
    return candidate.name === 'AbortError';
  }

  return false;
}

/**
 * 目的: Promiseにタイムアウト境界を与える。
 * 用途: 外部I/O待機が長引く処理を制御し、UI待機やテスト停滞を防ぐ。
 */
export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
