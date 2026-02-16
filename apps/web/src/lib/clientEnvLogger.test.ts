import { afterEach, describe, expect, test, vi } from 'vitest';
import { logger } from '@/api/core/logger';
import type { ClientEnvironmentSnapshot } from './clientEnvironment';
import { logClientEnvironment } from './clientEnvLogger';

function createSampleSnapshot(): ClientEnvironmentSnapshot {
  return {
    userAgent: 'Mozilla/5.0 UnitTest',
    language: 'ja-JP',
    languages: ['ja-JP', 'en-US'],
    platform: 'MacIntel',
    timezone: 'Asia/Tokyo',
    cookieEnabled: true,
    doNotTrack: '1',
    online: true,
    viewport: {
      width: 1280,
      height: 720,
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
    },
    devicePixelRatio: 2,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
    },
    path: '/login',
    referrerOrigin: 'https://example.com',
    capturedAt: '2026-02-16T00:00:00.000Z',
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logClientEnvironment', () => {
  test('環境情報がない場合は送信をスキップする', async () => {
    const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});

    const result = await logClientEnvironment({
      environment: null,
    });

    expect(result).toEqual({ sent: false, transport: 'none' });
    expect(debugSpy).toHaveBeenCalled();
  });

  test('sendBeacon成功時はbeaconで送信する', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
    });

    const fetchMock = vi.fn();

    const result = await logClientEnvironment({
      environment: createSampleSnapshot(),
      fetchImpl: fetchMock as never,
    });

    expect(result).toEqual({ sent: true, transport: 'beacon' });
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    const [, bodyBlob] = sendBeaconMock.mock.calls[0] as [string, BodyInit];
    expect(bodyBlob).toBeTruthy();
  });

  test('sendBeacon失敗時はfetchへフォールバックする', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    const result = await logClientEnvironment({
      environment: createSampleSnapshot(),
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({ sent: true, transport: 'fetch', status: 202 });
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const payload = JSON.parse(String(init.body)) as { requestId?: string };
    expect(headers['X-Correlation-ID']).toBeTruthy();
    expect(payload.requestId).toBe(headers['X-Correlation-ID']);
  });

  test('fetchが非2xxを返した場合はsent=false', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));

    const result = await logClientEnvironment({
      environment: createSampleSnapshot(),
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({ sent: false, transport: 'fetch', status: 500 });
  });

  test('transport=beacon指定でbeacon失敗時はfetchしない', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
    });

    const fetchMock = vi.fn();

    const result = await logClientEnvironment({
      environment: createSampleSnapshot(),
      transport: 'beacon',
      fetchImpl: fetchMock as never,
    });

    expect(result).toEqual({ sent: false, transport: 'beacon' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
