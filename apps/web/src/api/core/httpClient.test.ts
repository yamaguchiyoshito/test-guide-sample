import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetCsrfTokenCacheForTest, requestJson } from './httpClient';

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('requestJson CSRF behavior', () => {
  beforeEach(() => {
    __resetCsrfTokenCacheForTest();
  });

  afterEach(() => {
    __resetCsrfTokenCacheForTest();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POST時は取得済みCSRFトークンをキャッシュ再利用する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token-1' }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    await requestJson<{ ok: boolean }, Record<string, string>>('/api/login', {
      method: 'POST',
      withAuth: false,
      body: { email: 'user@example.com', password: 'password123' },
      retry: { maxAttempts: 1, enableBackoff: false },
    });
    await requestJson<{ ok: boolean }, Record<string, string>>('/api/login', {
      method: 'POST',
      withAuth: false,
      body: { email: 'user@example.com', password: 'password123' },
      retry: { maxAttempts: 1, enableBackoff: false },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
    });
  });

  it('403受信時はCSRFトークンを再取得して1回だけ再試行する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token-1' }, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { code: 'FORBIDDEN', message: 'CSRF token mismatch' },
          { status: 403, statusText: 'Forbidden' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token-2' }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await requestJson<{ ok: boolean }, Record<string, string>>('/api/login', {
      method: 'POST',
      withAuth: false,
      body: { email: 'user@example.com', password: 'password123' },
      retry: { maxAttempts: 1, enableBackoff: false },
    });

    expect(response.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-1' }),
    });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token-2' }),
    });
  });
});
