import { stripControlChars } from './securityUtils';

interface NavigatorConnectionLike {
  effectiveType?: unknown;
  downlink?: unknown;
  rtt?: unknown;
  saveData?: unknown;
}

interface NavigatorLike {
  userAgent?: unknown;
  language?: unknown;
  languages?: unknown;
  platform?: unknown;
  cookieEnabled?: unknown;
  doNotTrack?: unknown;
  onLine?: unknown;
  hardwareConcurrency?: unknown;
  maxTouchPoints?: unknown;
  deviceMemory?: unknown;
  connection?: NavigatorConnectionLike;
}

interface ScreenLike {
  width?: unknown;
  height?: unknown;
  availWidth?: unknown;
  availHeight?: unknown;
}

interface WindowLike {
  innerWidth?: unknown;
  innerHeight?: unknown;
  devicePixelRatio?: unknown;
  location?: {
    pathname?: unknown;
  };
  screen?: ScreenLike;
}

interface DocumentLike {
  referrer?: unknown;
}

export interface ClientEnvironmentConnection {
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean | null;
}

export interface ClientEnvironmentSnapshot {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string | null;
  timezone: string | null;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  online: boolean;
  viewport: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
  };
  devicePixelRatio: number | null;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxTouchPoints: number;
  connection: ClientEnvironmentConnection | null;
  path: string;
  referrerOrigin: string | null;
  capturedAt: string;
}

export interface CollectClientEnvironmentOptions {
  window?: WindowLike;
  navigator?: NavigatorLike;
  document?: DocumentLike;
  now?: () => Date;
  useGlobalFallback?: boolean;
}

function getGlobalWindow(): WindowLike | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window;
}

function getGlobalNavigator(): NavigatorLike | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator as NavigatorLike;
}

function getGlobalDocument(): DocumentLike | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document;
}

function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  return stripControlChars(value).trim();
}

function toNullableString(value: unknown): string | null {
  const normalized = toSafeString(value, '');
  return normalized.length > 0 ? normalized : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

function toNullableNonNegativeNumber(value: unknown, max?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (typeof max === 'number' && value > max) {
    return null;
  }

  return value;
}

function normalizePath(pathname: string): string {
  const normalized = stripControlChars(pathname).trim();
  if (normalized.length === 0) {
    return '/';
  }
  return normalized.startsWith('/') ? normalized : '/';
}

function toReferrerOrigin(referrer: unknown): string | null {
  if (typeof referrer !== 'string' || referrer.trim().length === 0) {
    return null;
  }

  try {
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}

function resolveTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone ? stripControlChars(timezone).trim() : null;
  } catch {
    return null;
  }
}

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => stripControlChars(item).trim())
    .filter((item) => item.length > 0)
    .slice(0, 10);
}

function normalizeConnection(connection: NavigatorConnectionLike | undefined): ClientEnvironmentConnection | null {
  if (!connection) {
    return null;
  }

  return {
    effectiveType: toNullableString(connection.effectiveType),
    downlink: toNullableNonNegativeNumber(connection.downlink, 10000),
    rtt: toNullableNonNegativeNumber(connection.rtt, 60000),
    saveData: typeof connection.saveData === 'boolean' ? connection.saveData : null,
  };
}

/**
 * 目的: ユーザーのブラウザ/端末/画面に関する実行環境情報を取得する。
 * 用途: 不具合調査・再現性分析・監査ログ向けに、個人データを含まない環境メタ情報を収集する。
 */
export function collectClientEnvironment(
  options: CollectClientEnvironmentOptions = {},
): ClientEnvironmentSnapshot | null {
  const useGlobalFallback = options.useGlobalFallback ?? true;
  const runtimeWindow = options.window ?? (useGlobalFallback ? getGlobalWindow() : undefined);
  const runtimeNavigator = options.navigator ?? (useGlobalFallback ? getGlobalNavigator() : undefined);
  const runtimeDocument = options.document ?? (useGlobalFallback ? getGlobalDocument() : undefined);

  if (!runtimeWindow || !runtimeNavigator) {
    return null;
  }

  const now = options.now ?? (() => new Date());
  const viewportWidth = toNonNegativeInt(runtimeWindow.innerWidth);
  const viewportHeight = toNonNegativeInt(runtimeWindow.innerHeight);
  const screenInfo = runtimeWindow.screen;

  return {
    userAgent: toSafeString(runtimeNavigator.userAgent),
    language: toSafeString(runtimeNavigator.language),
    languages: normalizeLanguages(runtimeNavigator.languages),
    platform: toNullableString(runtimeNavigator.platform),
    timezone: resolveTimezone(),
    cookieEnabled: toBoolean(runtimeNavigator.cookieEnabled),
    doNotTrack: toNullableString(runtimeNavigator.doNotTrack),
    online: toBoolean(runtimeNavigator.onLine, true),
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    screen: {
      width: toNonNegativeInt(screenInfo?.width, viewportWidth),
      height: toNonNegativeInt(screenInfo?.height, viewportHeight),
      availWidth: toNonNegativeInt(screenInfo?.availWidth, viewportWidth),
      availHeight: toNonNegativeInt(screenInfo?.availHeight, viewportHeight),
    },
    devicePixelRatio: toNullableNonNegativeNumber(runtimeWindow.devicePixelRatio, 16),
    hardwareConcurrency: toNullableNonNegativeNumber(runtimeNavigator.hardwareConcurrency, 1024),
    deviceMemory: toNullableNonNegativeNumber(runtimeNavigator.deviceMemory, 1024),
    maxTouchPoints: toNonNegativeInt(runtimeNavigator.maxTouchPoints),
    connection: normalizeConnection(runtimeNavigator.connection),
    path: normalizePath(toSafeString(runtimeWindow.location?.pathname, '/')),
    referrerOrigin: toReferrerOrigin(runtimeDocument?.referrer),
    capturedAt: now().toISOString(),
  };
}
