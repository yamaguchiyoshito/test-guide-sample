import type { ZodIssue, ZodSchema } from 'zod';
import { safeJsonParse, safeJsonStringify } from './utils';

const DEFAULT_REDACTED = '[REDACTED]';
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const DEFAULT_SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|api[-_]?key|authorization|cookie|session|credential|email)/i;
const REDIRECT_CONTROL_PATTERN = /[\u0000-\u001F\u007F\s]/;
const DEFAULT_MAX_LOG_DEPTH = 6;
const DEFAULT_MAX_LOG_STRING_LENGTH = 512;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const CSRF_TOKEN_FORMAT_PATTERN = /^[A-Za-z0-9_-]+$/;
const IPV4_SEGMENT_PATTERN = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
const IPV6_SEGMENT_PATTERN = /^[0-9A-Fa-f]{1,4}$/;
const INVALID_FILE_NAME_CHARS_PATTERN = /[\\/:*?"<>|]/g;
const FILE_NAME_EDGE_DOT_SPACE_PATTERN = /^[.\s]+|[.\s]+$/g;

/**
 * 目的: HTML特殊文字をエスケープして文字列として安全に扱う。
 * 用途: `dangerouslySetInnerHTML` や外部テンプレートへ埋め込む直前のXSS低減に使う。
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 目的: 制御文字を除去してログ汚染やヘッダ汚染を防ぐ。
 * 用途: ログ出力やヘッダ値に外部入力を使う前のサニタイズに使う。
 */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHAR_PATTERN, '');
}

/**
 * 目的: HTTPヘッダ値を安全な形式へ正規化する。
 * 用途: 外部入力をヘッダへ設定する前に CRLF/制御文字/過長値を除去する。
 */
export function normalizeHeaderValue(value: string, maxLength = 256): string {
  const safe = stripControlChars(value).trim();
  if (safe.length <= maxLength) {
    return safe;
  }
  return safe.slice(0, maxLength);
}

/**
 * 目的: 機微情報を部分マスクして出力可能にする。
 * 用途: トレースや監査ログに値の存在だけ残したい時に使う。
 */
export function maskSensitiveValue(
  value: string,
  keepStart = 2,
  keepEnd = 2,
  maskChar = '*',
): string {
  if (value.length === 0) {
    return '';
  }

  const start = Math.max(0, Math.floor(keepStart));
  const end = Math.max(0, Math.floor(keepEnd));
  if (start + end >= value.length) {
    return maskChar.repeat(value.length);
  }

  const maskedLength = value.length - start - end;
  return `${value.slice(0, start)}${maskChar.repeat(maskedLength)}${value.slice(value.length - end)}`;
}

export interface RedactOptions {
  redactedText?: string;
  sensitiveKeyPattern?: RegExp;
  maxDepth?: number;
}

/**
 * 目的: オブジェクト中の機微キーを再帰的に秘匿化する。
 * 用途: APIコンテキストや例外詳細をログへ送る前の共通マスキングで使う。
 */
export function redactSensitiveObject<T>(
  value: T,
  options: RedactOptions = {},
  depth = 0,
): T {
  const redactedText = options.redactedText ?? DEFAULT_REDACTED;
  const keyPattern = options.sensitiveKeyPattern ?? DEFAULT_SENSITIVE_KEY_PATTERN;
  const maxDepth = options.maxDepth ?? 6;

  if (depth > maxDepth) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveObject(item, options, depth + 1)) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (keyPattern.test(key)) {
        result[key] = redactedText;
      } else {
        result[key] = redactSensitiveObject(item, options, depth + 1);
      }
    }

    return result as T;
  }

  return value;
}

export interface SanitizeLogContextOptions extends RedactOptions {
  maxStringLength?: number;
}

function truncateForLog(value: string, maxStringLength: number): string {
  if (value.length <= maxStringLength) {
    return value;
  }
  return `${value.slice(0, maxStringLength)}...[truncated]`;
}

function sanitizeLogValue(
  value: unknown,
  options: Required<SanitizeLogContextOptions>,
  depth: number,
  visited: WeakSet<object>,
): unknown {
  if (typeof value === 'string') {
    return truncateForLog(stripControlChars(value), options.maxStringLength);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateForLog(stripControlChars(value.message), options.maxStringLength),
    };
  }

  if (depth >= options.maxDepth) {
    return '[MaxDepth]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, options, depth + 1, visited));
  }

  if (typeof value === 'object') {
    if (visited.has(value)) {
      return '[Circular]';
    }
    visited.add(value);

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (options.sensitiveKeyPattern.test(key)) {
        output[key] = options.redactedText;
      } else {
        output[key] = sanitizeLogValue(item, options, depth + 1, visited);
      }
    }

    return output;
  }

  return String(value);
}

/**
 * 目的: ログコンテキストを機微秘匿・制御文字除去・長さ制限付きで整形する。
 * 用途: logger出力前に安全化し、情報漏えいとログ破壊を抑制する。
 */
export function sanitizeLogContext(
  context: Record<string, unknown>,
  options: SanitizeLogContextOptions = {},
): Record<string, unknown> {
  const merged: Required<SanitizeLogContextOptions> = {
    redactedText: options.redactedText ?? DEFAULT_REDACTED,
    sensitiveKeyPattern: options.sensitiveKeyPattern ?? DEFAULT_SENSITIVE_KEY_PATTERN,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_LOG_DEPTH,
    maxStringLength: options.maxStringLength ?? DEFAULT_MAX_LOG_STRING_LENGTH,
  };
  const visited = new WeakSet<object>();
  return sanitizeLogValue(context, merged, 0, visited) as Record<string, unknown>;
}

/**
 * 目的: リダイレクト先がアプリ内パスとして安全か判定する。
 * 用途: ログイン後の `next` クエリ等によるオープンリダイレクトを防止する。
 */
export function isSafeRedirectPath(path: string): boolean {
  if (!path || REDIRECT_CONTROL_PATTERN.test(path)) {
    return false;
  }

  if (!path.startsWith('/')) {
    return false;
  }

  // `//evil.com` や `\` を含むケースを拒否する。
  if (path.startsWith('//') || path.includes('\\')) {
    return false;
  }

  // スキーム混入（例: /https://evil.com）を拒否する。
  if (/^\/[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) {
    return false;
  }

  return true;
}

/**
 * 目的: 不正な候補値を安全なフォールバックへ丸める。
 * 用途: リダイレクト実行前に常にこの関数を通して経路固定する。
 */
export function toSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = '/',
): string {
  if (!candidate) {
    return fallback;
  }
  return isSafeRedirectPath(candidate) ? candidate : fallback;
}

interface SearchParamLike {
  get(name: string): string | null;
}

type NextPathSource = string | URLSearchParams | SearchParamLike;

/**
 * 目的: クエリ文字列から next パラメータを安全な内部パスへ変換する。
 * 用途: ログイン完了後遷移でオープンリダイレクトを防ぐ。
 */
export function toSafeNextPathFromQuery(
  source: NextPathSource,
  key = 'next',
  fallback = '/',
): string {
  if (typeof source === 'string') {
    const raw = source.startsWith('?') ? source.slice(1) : source;
    return toSafeRedirectPath(new URLSearchParams(raw).get(key), fallback);
  }

  return toSafeRedirectPath(source.get(key), fallback);
}

/**
 * 目的: URLのoriginが許可リストに含まれるか検証する。
 * 用途: 外部コールバックURLやiframe連携先の受け入れ判定に使う。
 */
export function isAllowedOrigin(url: string, allowedOrigins: string[]): boolean {
  try {
    const parsed = new URL(url);
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

export interface ValidateRequestOriginOptions {
  allowMissingOrigin?: boolean;
  allowRefererFallback?: boolean;
}

/**
 * 目的: RequestのOrigin/Refererが許可リスト内か検証する。
 * 用途: 重要APIのCSRF軽減としてクロスオリジン送信を早期に拒否する。
 */
export function validateRequestOrigin(
  request: Request,
  allowedOrigins: string[],
  options: ValidateRequestOriginOptions = {},
): boolean {
  if (allowedOrigins.length === 0) {
    return true;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    return allowedOrigins.includes(origin);
  }

  const allowRefererFallback = options.allowRefererFallback ?? true;
  if (allowRefererFallback) {
    const referer = request.headers.get('referer');
    if (referer) {
      return isAllowedOrigin(referer, allowedOrigins);
    }
  }

  return options.allowMissingOrigin ?? false;
}

export type SafeJsonParseWithSchemaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error; issues?: ZodIssue[] };

/**
 * 目的: JSON文字列の構文とスキーマを1回で検証する。
 * 用途: API routeの入力検証でパース失敗と型不一致を同一フローで扱う。
 */
export function safeJsonParseWithSchema<T>(
  raw: string,
  schema: ZodSchema<T>,
): SafeJsonParseWithSchemaResult<T> {
  const parsed = safeJsonParse<unknown>(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const validated = schema.safeParse(parsed.data);
  if (!validated.success) {
    return {
      ok: false,
      error: new Error('Schema validation failed'),
      issues: validated.error.issues,
    };
  }

  return { ok: true, data: validated.data };
}

function canonicalizeJsonValue(value: unknown, visited: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, visited));
  }

  if (typeof value === 'object') {
    if (visited.has(value)) {
      return '[Circular]';
    }
    visited.add(value);

    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};

    for (const key of keys) {
      out[key] = canonicalizeJsonValue(source[key], visited);
    }

    return out;
  }

  return String(value);
}

/**
 * 目的: キー順を固定したJSON文字列へ正規化する。
 * 用途: 署名・ハッシュ・冪等キー生成で入力順依存をなくす。
 */
export function canonicalJsonStringify(value: unknown): string {
  const canonical = canonicalizeJsonValue(value, new WeakSet<object>());
  return JSON.stringify(canonical);
}

/**
 * 目的: 文字列比較を定数時間に近づけてタイミング差を抑制する。
 * 用途: トークン比較や署名比較のクライアント側補助判定に使う。
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  const maxLength = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLength; i += 1) {
    const aByte = i < aBytes.length ? aBytes[i] : 0;
    const bByte = i < bBytes.length ? bBytes[i] : 0;
    diff |= aByte ^ bByte;
  }

  return diff === 0;
}

/**
 * 目的: AuthorizationヘッダからBearerトークンを安全に抽出する。
 * 用途: API routeでの認証トークン読取処理を一元化する。
 */
export function parseAuthHeaderBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const normalized = stripControlChars(authHeader).trim();
  const match = /^Bearer\s+(.+)$/i.exec(normalized);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  if (token.length === 0 || /\s/.test(token)) {
    return null;
  }

  return token;
}

/**
 * 目的: RequestのContent-Typeが許可値かを判定する。
 * 用途: API routeで想定外のMIMEを早期拒否する。
 */
export function validateContentType(request: Request, allowed: string[]): boolean {
  if (allowed.length === 0) {
    return true;
  }

  const contentType = request.headers.get('content-type');
  if (!contentType) {
    return false;
  }

  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return allowed.map((item) => item.trim().toLowerCase()).includes(normalized);
}

/**
 * 目的: 生ボディのサイズ上限を検証する。
 * 用途: API routeで過大リクエストのDoSリスクを低減する。
 */
export function enforceMaxBodySize(rawBody: string, maxBytes: number): boolean {
  const max = Math.max(0, Math.floor(maxBytes));
  return new TextEncoder().encode(rawBody).byteLength <= max;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * 目的: 予測困難なランダムトークンを生成する。
 * 用途: nonce / state / CSRF補助トークンなどの一時値生成に使う。
 */
export function createSecureToken(byteLength = 32): string {
  const length = Math.max(16, Math.floor(byteLength));
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytesToBase64(bytes));
}

/**
 * 目的: 文字列をSHA-256ハッシュ(16進)へ変換する。
 * 用途: 監査ログ用の不可逆化キーや署名前の正規化キー生成に使う。
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 目的: トークン比較時の長さ要件と定数時間比較を一体化する。
 * 用途: CSRFトークンやワンタイムトークンの照合で早期漏えいを抑える。
 */
export function secureCompareToken(
  expected: string,
  actual: string,
  minLength = 16,
): boolean {
  const hasMinLength = expected.length >= minLength && actual.length >= minLength;
  return hasMinLength && constantTimeEqual(expected, actual);
}

/**
 * 目的: CSRFトークン文字列の形式と最小長を検証する。
 * 用途: 照合前にトークンの構文を絞り、不要な比較処理や誤判定を防ぐ。
 */
export function isValidCsrfTokenFormat(token: string, minLength = 16): boolean {
  const normalized = stripControlChars(token).trim();
  return normalized.length >= minLength && CSRF_TOKEN_FORMAT_PATTERN.test(normalized);
}

/**
 * 目的: ダブルサブミットCookie方式のCSRFトークン照合を統一する。
 * 用途: Cookie値とヘッダ値の一致判定を安全に行う。
 */
export function verifyCsrfDoubleSubmit(
  cookieToken: string | null | undefined,
  headerToken: string | null | undefined,
  minLength = 16,
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  const normalizedCookieToken = stripControlChars(cookieToken).trim();
  const normalizedHeaderToken = stripControlChars(headerToken).trim();

  if (
    !isValidCsrfTokenFormat(normalizedCookieToken, minLength) ||
    !isValidCsrfTokenFormat(normalizedHeaderToken, minLength)
  ) {
    return false;
  }

  return secureCompareToken(normalizedCookieToken, normalizedHeaderToken, minLength);
}

/**
 * 目的: リクエスト内容から再計算可能な冪等キーを生成する。
 * 用途: 同一送信の重複実行防止キー（Idempotency-Key）を統一生成する。
 */
export async function createIdempotencyKey(
  scope: string,
  payload: unknown,
): Promise<string> {
  const normalizedScope = stripControlChars(scope).trim().toLowerCase() || 'global';
  const normalizedPayload = canonicalJsonStringify(payload);
  const hash = await sha256Hex(`${normalizedScope}:${normalizedPayload}`);
  return `${normalizedScope}:${hash}`;
}

export interface RequestFingerprintInput {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  userId?: string | null;
}

/**
 * 目的: リクエスト同一性を判定するフィンガープリントを生成する。
 * 用途: 冪等制御や重複送信検知のキーとして利用する。
 */
export async function createRequestFingerprint(
  input: RequestFingerprintInput,
): Promise<string> {
  const canonicalInput = {
    method: stripControlChars(input.method).toUpperCase(),
    path: stripControlChars(input.path).trim(),
    query: input.query ?? null,
    body: input.body ?? null,
    userId: input.userId ?? null,
  };
  const canonical = canonicalJsonStringify(canonicalInput);
  return sha256Hex(canonical);
}

/**
 * 目的: 外部遷移先URLを許可オリジンで制限する。
 * 用途: 外部リダイレクト時のopen redirectリスクを抑える。
 */
export function safeExternalRedirectUrl(
  candidate: string | null | undefined,
  allowedOrigins: string[],
  fallback: string,
): string {
  if (!candidate) {
    return fallback;
  }

  if (candidate.startsWith('/')) {
    return toSafeRedirectPath(candidate, fallback);
  }

  try {
    const parsed = new URL(candidate);
    if (allowedOrigins.includes(parsed.origin)) {
      return parsed.toString();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeIpCandidate(value: string): string {
  const trimmed = stripControlChars(value).trim();
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    if (end > 1) {
      return trimmed.slice(1, end).toLowerCase();
    }
  }

  const ipv4WithPortMatch = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
  if (ipv4WithPortMatch) {
    return ipv4WithPortMatch[1];
  }

  return trimmed.toLowerCase();
}

function isValidIpv4Address(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => IPV4_SEGMENT_PATTERN.test(part));
}

function isValidIpv6Address(value: string): boolean {
  const partsByCompression = value.split('::');
  if (partsByCompression.length > 2) {
    return false;
  }

  const left = partsByCompression[0]
    ? partsByCompression[0].split(':').filter((part) => part.length > 0)
    : [];
  const right =
    partsByCompression.length === 2 && partsByCompression[1]
      ? partsByCompression[1].split(':').filter((part) => part.length > 0)
      : [];

  if (partsByCompression.length === 1 && left.length !== 8) {
    return false;
  }

  if (partsByCompression.length === 2 && left.length + right.length >= 8) {
    return false;
  }

  const hextets = [...left, ...right];
  return hextets.length > 0 && hextets.every((part) => IPV6_SEGMENT_PATTERN.test(part));
}

/**
 * 目的: 文字列がIPv4/IPv6として妥当か判定する。
 * 用途: 監査ログやレート制限で利用するIP値の入力検証に使う。
 */
export function isValidIpAddress(value: string): boolean {
  const normalized = normalizeIpCandidate(value);
  return isValidIpv4Address(normalized) || isValidIpv6Address(normalized);
}

/**
 * 目的: リバースプロキシ環境を考慮してクライアントIPを抽出する。
 * 用途: API監査ログ、レート制限キー生成、異常アクセス検知の入力として利用する。
 */
export function extractClientIp(
  request: Request,
  headerPriority: string[] = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
): string | null {
  for (const headerName of headerPriority) {
    const raw = request.headers.get(headerName);
    if (!raw) {
      continue;
    }

    const first = raw.split(',')[0]?.trim();
    if (!first) {
      continue;
    }

    const normalized = normalizeIpCandidate(first);
    if (isValidIpAddress(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * 目的: Cookieヘッダを安全にパースしてキー/値辞書へ変換する。
 * 用途: API routeでCookie抽出を共通化し、重複実装と不正入力の混入を防ぐ。
 */
export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const pairs = cookieHeader.split(';');
  const cookies: Record<string, string> = {};

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const rawName = stripControlChars(pair.slice(0, separatorIndex)).trim();
    const rawValue = stripControlChars(pair.slice(separatorIndex + 1)).trim();

    if (!COOKIE_NAME_PATTERN.test(rawName)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(cookies, rawName)) {
      continue;
    }

    cookies[rawName] = tryDecodeURIComponent(rawValue);
  }

  return cookies;
}

/**
 * 目的: Cookieヘッダから特定キーの値を取得する。
 * 用途: Cookie個別読取を1行化し、存在判定ロジックを統一する。
 */
export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  return Object.prototype.hasOwnProperty.call(cookies, name) ? cookies[name] : null;
}

export interface BuildSecureSetCookieHeaderOptions {
  path?: string;
  domain?: string;
  maxAgeSeconds?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * 目的: Set-Cookie文字列をセキュア既定値付きで生成する。
 * 用途: API routeでCookie属性の付け忘れを防ぎ、属性設定を統一する。
 */
export function buildSecureSetCookieHeader(
  name: string,
  value: string,
  options: BuildSecureSetCookieHeaderOptions = {},
): string {
  const cookieName = stripControlChars(name).trim();
  if (!COOKIE_NAME_PATTERN.test(cookieName)) {
    throw new Error(`Invalid cookie name: ${name}`);
  }

  const httpOnly = options.httpOnly ?? true;
  const secure = options.secure ?? true;
  const sameSite = options.sameSite ?? 'Lax';

  if (sameSite === 'None' && !secure) {
    throw new Error('SameSite=None requires Secure=true');
  }

  const segments: string[] = [];
  segments.push(`${cookieName}=${encodeURIComponent(stripControlChars(value))}`);
  segments.push(`Path=${options.path?.trim() || '/'}`);
  segments.push(`SameSite=${sameSite}`);

  if (options.domain) {
    segments.push(`Domain=${stripControlChars(options.domain).trim()}`);
  }

  if (typeof options.maxAgeSeconds === 'number' && Number.isFinite(options.maxAgeSeconds)) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }

  if (options.expires instanceof Date && !Number.isNaN(options.expires.getTime())) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (httpOnly) {
    segments.push('HttpOnly');
  }

  if (secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}

function sanitizeFileNameCore(value: string): string {
  return stripControlChars(value.normalize('NFKC'))
    .replace(INVALID_FILE_NAME_CHARS_PATTERN, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FILE_NAME_EDGE_DOT_SPACE_PATTERN, '');
}

function truncateFileNamePreservingExtension(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const extensionIndex = value.lastIndexOf('.');
  const hasExtension = extensionIndex > 0 && extensionIndex < value.length - 1;
  if (!hasExtension) {
    return value.slice(0, maxLength);
  }

  const extension = value.slice(extensionIndex);
  const baseName = value.slice(0, extensionIndex);
  if (extension.length >= maxLength) {
    return value.slice(0, maxLength);
  }

  return `${baseName.slice(0, maxLength - extension.length)}${extension}`;
}

export interface SanitizeFileNameOptions {
  fallback?: string;
  maxLength?: number;
}

/**
 * 目的: アップロードファイル名を安全な文字列へ正規化する。
 * 用途: パス走査やOS依存文字を排除し、保存先ファイル名を安定化する。
 */
export function sanitizeFileName(
  value: string,
  options: SanitizeFileNameOptions = {},
): string {
  const maxLength = Math.max(1, Math.floor(options.maxLength ?? 120));
  const fallbackRaw = options.fallback ?? 'file';
  const fallback = truncateFileNamePreservingExtension(
    sanitizeFileNameCore(fallbackRaw) || 'file',
    maxLength,
  );

  const sanitized = sanitizeFileNameCore(value);
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return fallback;
  }

  return truncateFileNamePreservingExtension(sanitized, maxLength);
}

/**
 * 目的: ファイル名の拡張子が許可リスト内か判定する。
 * 用途: アップロード受付時に許可拡張子以外を早期拒否する。
 */
export function hasAllowedFileExtension(
  fileName: string,
  allowedExtensions: string[],
): boolean {
  if (allowedExtensions.length === 0) {
    return true;
  }

  const sanitized = sanitizeFileName(fileName, { fallback: 'file', maxLength: 255 });
  const index = sanitized.lastIndexOf('.');
  if (index <= 0 || index === sanitized.length - 1) {
    return false;
  }

  const extension = sanitized.slice(index + 1).toLowerCase();
  const normalizedAllowed = allowedExtensions.map((item) =>
    item.replace(/^\./, '').toLowerCase(),
  );
  return normalizedAllowed.includes(extension);
}
