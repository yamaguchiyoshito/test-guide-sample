import { describe, expect, test } from 'vitest';
import {
  collectClientEnvironment,
  type CollectClientEnvironmentOptions,
} from './clientEnvironment';

function createBaseOptions(): CollectClientEnvironmentOptions {
  return {
    useGlobalFallback: false,
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      devicePixelRatio: 2,
      location: {
        pathname: '/login',
      },
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
      },
    },
    navigator: {
      userAgent: 'Mozilla/5.0 TestBrowser',
      language: 'ja-JP',
      languages: ['ja-JP', 'en-US'],
      platform: 'MacIntel',
      cookieEnabled: true,
      doNotTrack: '1',
      onLine: true,
      hardwareConcurrency: 8,
      maxTouchPoints: 0,
      deviceMemory: 8,
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      },
    },
    document: {
      referrer: 'https://example.com/path?a=1',
    },
    now: () => new Date('2026-02-16T12:34:56.000Z'),
  };
}

describe('collectClientEnvironment', () => {
  test('ブラウザ環境情報をスナップショットとして取得できる', () => {
    const snapshot = collectClientEnvironment(createBaseOptions());
    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      userAgent: 'Mozilla/5.0 TestBrowser',
      language: 'ja-JP',
      languages: ['ja-JP', 'en-US'],
      platform: 'MacIntel',
      timezone: expect.any(String),
      cookieEnabled: true,
      doNotTrack: '1',
      online: true,
      viewport: { width: 1280, height: 720 },
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
      devicePixelRatio: 2,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
      path: '/login',
      referrerOrigin: 'https://example.com',
      capturedAt: '2026-02-16T12:34:56.000Z',
    });
  });

  test('ランタイムがない場合はnullを返す', () => {
    expect(
      collectClientEnvironment({
        useGlobalFallback: false,
      }),
    ).toBeNull();
  });

  test('不正な値は安全なフォールバックへ丸める', () => {
    const snapshot = collectClientEnvironment({
      ...createBaseOptions(),
      window: {
        innerWidth: -1,
        innerHeight: Number.NaN,
        location: {
          pathname: 'dashboard',
        },
      },
      navigator: {
        userAgent: '\u0000UA',
        language: '   ',
        languages: ['ja-JP', '', '  en-US  '],
        cookieEnabled: 'yes',
      },
      document: {
        referrer: 'not-a-url',
      },
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      userAgent: 'UA',
      language: '',
      languages: ['ja-JP', 'en-US'],
      cookieEnabled: false,
      viewport: {
        width: 0,
        height: 0,
      },
      path: '/',
      referrerOrigin: null,
    });
  });
});
