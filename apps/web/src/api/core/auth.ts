import { getJwtExpMs } from '@/lib/utils';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REFRESH_PATH = '/api/auth/refresh';

// 同時401でrefreshが多重実行されないよう、進行中Promiseを共有する。
let refreshPromise: Promise<string | null> | null = null;

class AuthStore {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export const authStore = new AuthStore();

/**
 * 目的: アクセストークンがリフレッシュ閾値内かを判定する。
 * 用途: API呼び出し直前に、先回りリフレッシュが必要かを判断する時に使う。
 */
export function isTokenExpiringSoon(token: string, marginMs = 5 * 60 * 1000): boolean {
  const expiresAt = getJwtExpMs(token);
  if (!expiresAt) {
    return true;
  }

  return expiresAt - Date.now() < marginMs;
}

/**
 * 目的: リフレッシュトークンでアクセストークンを再取得する。
 * 用途: 401発生時や期限切れ直前判定時に、共通HTTPクライアントから呼び出す。
 */
export async function forceRefreshToken(baseUrl: string): Promise<string | null> {
  // SSRではtoken refreshを行わない（ブラウザストレージ非対応）。
  if (typeof window === 'undefined') {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${baseUrl}${REFRESH_PATH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        authStore.clearTokens();
        return null;
      }

      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) {
        authStore.clearTokens();
        return null;
      }

      authStore.setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      authStore.clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * 目的: API送信に使えるアクセストークンを保証する。
 * 用途: 各リクエストのヘッダ構築前に呼び、必要時だけ透過的にrefreshする。
 */
export async function ensureValidToken(baseUrl: string): Promise<string | null> {
  const token = authStore.getAccessToken();

  if (!token) {
    return null;
  }

  if (!isTokenExpiringSoon(token)) {
    return token;
  }

  // refresh失敗時は既存tokenを返し、最終的な判定はAPIレスポンス側に委ねる。
  const refreshed = await forceRefreshToken(baseUrl);
  return refreshed ?? token;
}
