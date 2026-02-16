import { z } from 'zod';
import { describe, expect, test } from 'vitest';
import {
  buildSecureSetCookieHeader,
  canonicalJsonStringify,
  constantTimeEqual,
  createIdempotencyKey,
  createRequestFingerprint,
  createSecureToken,
  enforceMaxBodySize,
  escapeHtml,
  extractClientIp,
  getCookieValue,
  hasAllowedFileExtension,
  isValidCsrfTokenFormat,
  isValidIpAddress,
  isAllowedOrigin,
  isSafeRedirectPath,
  maskSensitiveValue,
  normalizeHeaderValue,
  parseCookieHeader,
  parseAuthHeaderBearerToken,
  redactSensitiveObject,
  safeExternalRedirectUrl,
  safeJsonParseWithSchema,
  sanitizeFileName,
  sanitizeLogContext,
  secureCompareToken,
  sha256Hex,
  stripControlChars,
  toSafeNextPathFromQuery,
  toSafeRedirectPath,
  validateContentType,
  validateRequestOrigin,
  verifyCsrfDoubleSubmit,
} from './securityUtils';

describe('escapeHtml', () => {
  test('HTML特殊文字をエスケープする', () => {
    expect(escapeHtml(`<script>alert('xss')</script>`)).toBe(
      '&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;',
    );
  });
});

describe('stripControlChars', () => {
  test('制御文字を除去する', () => {
    expect(stripControlChars('ab\u0000c\u0009d\u001Fe')).toBe('abcde');
  });
});

describe('normalizeHeaderValue', () => {
  test('制御文字を除去してtrimする', () => {
    expect(normalizeHeaderValue('  abc\r\ndef  ')).toBe('abcdef');
  });

  test('最大長で切り詰める', () => {
    expect(normalizeHeaderValue('1234567890', 5)).toBe('12345');
  });
});

describe('maskSensitiveValue', () => {
  test('前後を残してマスクする', () => {
    expect(maskSensitiveValue('abcdef123456', 2, 2)).toBe('ab********56');
  });

  test('短い値は全マスクする', () => {
    expect(maskSensitiveValue('abcd', 3, 2)).toBe('****');
  });
});

describe('redactSensitiveObject', () => {
  test('機微キーを再帰的に秘匿化する', () => {
    const input = {
      accessToken: 'abc',
      profile: {
        password: 'secret',
        email: 'user@example.com',
      },
      headers: [{ Authorization: 'Bearer token' }],
    };

    expect(redactSensitiveObject(input)).toEqual({
      accessToken: '[REDACTED]',
      profile: {
        password: '[REDACTED]',
        email: '[REDACTED]',
      },
      headers: [{ Authorization: '[REDACTED]' }],
    });
  });
});

describe('sanitizeLogContext', () => {
  test('機微情報を秘匿し制御文字を除去する', () => {
    const context = {
      Authorization: 'Bearer token',
      email: 'user@example.com',
      note: 'line1\nline2\u0000',
    };

    expect(sanitizeLogContext(context)).toEqual({
      Authorization: '[REDACTED]',
      email: '[REDACTED]',
      note: 'line1line2',
    });
  });

  test('循環参照を安全に処理する', () => {
    const obj: { self?: unknown; value: string } = { value: 'ok' };
    obj.self = obj;

    const sanitized = sanitizeLogContext({ obj });
    expect(sanitized.obj).toEqual({
      value: 'ok',
      self: '[Circular]',
    });
  });
});

describe('redirect safety', () => {
  test('安全なアプリ内パスを許可する', () => {
    expect(isSafeRedirectPath('/dashboard')).toBe(true);
    expect(isSafeRedirectPath('/users?id=1')).toBe(true);
  });

  test('危険なパスを拒否する', () => {
    expect(isSafeRedirectPath('https://evil.com')).toBe(false);
    expect(isSafeRedirectPath('//evil.com')).toBe(false);
    expect(isSafeRedirectPath('/\\evil')).toBe(false);
    expect(isSafeRedirectPath('/javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectPath('/path with-space')).toBe(false);
  });

  test('不正候補はフォールバックへ丸める', () => {
    expect(toSafeRedirectPath('//evil.com', '/home')).toBe('/home');
    expect(toSafeRedirectPath('/settings', '/home')).toBe('/settings');
    expect(toSafeRedirectPath(undefined, '/home')).toBe('/home');
  });

  test('nextクエリから安全な遷移先を抽出する', () => {
    expect(toSafeNextPathFromQuery('?next=/dashboard', 'next', '/')).toBe('/dashboard');
    expect(toSafeNextPathFromQuery('?next=//evil.com', 'next', '/')).toBe('/');
    expect(toSafeNextPathFromQuery(new URLSearchParams('next=/users'), 'next', '/')).toBe('/users');
  });
});

describe('isAllowedOrigin', () => {
  test('許可済みoriginのみ通す', () => {
    const allowed = ['https://example.com', 'https://app.example.com'];
    expect(isAllowedOrigin('https://example.com/path', allowed)).toBe(true);
    expect(isAllowedOrigin('https://evil.example.net/path', allowed)).toBe(false);
    expect(isAllowedOrigin('not-a-url', allowed)).toBe(false);
  });
});

describe('validateRequestOrigin', () => {
  test('allow listが空なら常に許可', () => {
    const request = new Request('https://example.com/api/login', { method: 'POST' });
    expect(validateRequestOrigin(request, [])).toBe(true);
  });

  test('Originヘッダが許可済みなら許可', () => {
    const request = new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { origin: 'https://example.com' },
    });
    expect(validateRequestOrigin(request, ['https://example.com'])).toBe(true);
    expect(validateRequestOrigin(request, ['https://evil.com'])).toBe(false);
  });

  test('OriginがなくRefererが許可済みなら許可', () => {
    const request = new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { referer: 'https://example.com/login' },
    });
    expect(validateRequestOrigin(request, ['https://example.com'])).toBe(true);
  });
});

describe('safeJsonParseWithSchema', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().int().nonnegative(),
  });

  test('構文/スキーマとも正常ならok=true', () => {
    const parsed = safeJsonParseWithSchema('{"name":"alice","age":20}', schema);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.name).toBe('alice');
    }
  });

  test('JSON構文エラーを返す', () => {
    const parsed = safeJsonParseWithSchema('{"name":', schema);
    expect(parsed.ok).toBe(false);
  });

  test('スキーマ不一致でissuesを返す', () => {
    const parsed = safeJsonParseWithSchema('{"name":"alice","age":"20"}', schema);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues?.length).toBeGreaterThan(0);
    }
  });
});

describe('canonicalJsonStringify', () => {
  test('キー順を固定化して文字列化する', () => {
    const a = canonicalJsonStringify({ b: 1, a: 2, nested: { z: 0, x: 1 } });
    const b = canonicalJsonStringify({ nested: { x: 1, z: 0 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });
});

describe('constantTimeEqual', () => {
  test('同一文字列はtrue', () => {
    expect(constantTimeEqual('token-abc', 'token-abc')).toBe(true);
  });

  test('異なる文字列はfalse', () => {
    expect(constantTimeEqual('token-abc', 'token-abd')).toBe(false);
    expect(constantTimeEqual('short', 'longer')).toBe(false);
  });
});

describe('createSecureToken', () => {
  test('十分な長さのbase64url文字列を生成する', () => {
    const token = createSecureToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  test('連続生成で異なる値になる', () => {
    const token1 = createSecureToken();
    const token2 = createSecureToken();
    expect(token1).not.toBe(token2);
  });
});

describe('parseAuthHeaderBearerToken', () => {
  test('Bearer形式からトークンを抽出する', () => {
    expect(parseAuthHeaderBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(parseAuthHeaderBearerToken('bearer abc123')).toBe('abc123');
  });

  test('不正形式はnull', () => {
    expect(parseAuthHeaderBearerToken('Basic xxx')).toBeNull();
    expect(parseAuthHeaderBearerToken('Bearer')).toBeNull();
    expect(parseAuthHeaderBearerToken(null)).toBeNull();
  });
});

describe('validateContentType', () => {
  test('許可MIMEを判定する', () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(validateContentType(request, ['application/json'])).toBe(true);
    expect(validateContentType(request, ['text/plain'])).toBe(false);
  });
});

describe('enforceMaxBodySize', () => {
  test('最大サイズ内ならtrue', () => {
    expect(enforceMaxBodySize('abc', 3)).toBe(true);
  });

  test('最大サイズ超過ならfalse', () => {
    expect(enforceMaxBodySize('abcd', 3)).toBe(false);
  });
});

describe('sha256Hex', () => {
  test('既知文字列のhash値を返す', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('secureCompareToken', () => {
  test('同値かつ最小長を満たせばtrue', () => {
    expect(secureCompareToken('0123456789abcdef', '0123456789abcdef')).toBe(true);
  });

  test('不一致または短すぎる場合はfalse', () => {
    expect(secureCompareToken('0123456789abcdef', '0123456789abcdeg')).toBe(false);
    expect(secureCompareToken('short', 'short')).toBe(false);
  });
});

describe('verifyCsrfDoubleSubmit', () => {
  test('一致すればtrue', () => {
    expect(verifyCsrfDoubleSubmit('0123456789abcdef', '0123456789abcdef')).toBe(true);
  });

  test('不一致または未設定はfalse', () => {
    expect(verifyCsrfDoubleSubmit('0123456789abcdef', 'xxxx')).toBe(false);
    expect(verifyCsrfDoubleSubmit(null, '0123456789abcdef')).toBe(false);
  });

  test('形式不正トークンはfalse', () => {
    expect(verifyCsrfDoubleSubmit('0123 456789abcdef', '0123 456789abcdef')).toBe(false);
  });
});

describe('isValidCsrfTokenFormat', () => {
  test('base64url形式の十分な長さを許可する', () => {
    expect(isValidCsrfTokenFormat('AbCdEf0123456789_-')).toBe(true);
  });

  test('空白や短すぎる値は拒否する', () => {
    expect(isValidCsrfTokenFormat('invalid token')).toBe(false);
    expect(isValidCsrfTokenFormat('short')).toBe(false);
  });
});

describe('cookie utils', () => {
  test('Cookieヘッダをパースできる', () => {
    const cookies = parseCookieHeader(
      'session=abc123; theme=light; encoded=%E3%83%86%E3%82%B9%E3%83%88',
    );

    expect(cookies).toEqual({
      session: 'abc123',
      theme: 'light',
      encoded: 'テスト',
    });
  });

  test('同名Cookieは先勝ちで保持する', () => {
    const cookies = parseCookieHeader('theme=dark; theme=light');
    expect(cookies.theme).toBe('dark');
  });

  test('特定Cookie値を取得できる', () => {
    const value = getCookieValue('session=token123; theme=dark', 'session');
    expect(value).toBe('token123');
    expect(getCookieValue('session=token123', 'missing')).toBeNull();
  });

  test('セキュア既定値付きSet-Cookieを生成する', () => {
    const cookie = buildSecureSetCookieHeader('session', 'abc 123');
    expect(cookie).toContain('session=abc%20123');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  test('SameSite=NoneかつSecure=falseは拒否する', () => {
    expect(() =>
      buildSecureSetCookieHeader('session', 'value', {
        sameSite: 'None',
        secure: false,
      }),
    ).toThrow('SameSite=None requires Secure=true');
  });
});

describe('ip utils', () => {
  test('IPv4とIPv6の形式を判定できる', () => {
    expect(isValidIpAddress('192.168.0.1')).toBe(true);
    expect(isValidIpAddress('2001:db8::1')).toBe(true);
    expect(isValidIpAddress('999.168.0.1')).toBe(false);
  });

  test('優先ヘッダ順でクライアントIPを抽出する', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.1, 198.51.100.2',
      },
    });
    expect(extractClientIp(request)).toBe('203.0.113.1');
  });

  test('先頭候補が不正なら次ヘッダへフォールバックする', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': 'bad-ip',
        'x-real-ip': '198.51.100.7',
      },
    });
    expect(extractClientIp(request)).toBe('198.51.100.7');
  });
});

describe('file name utils', () => {
  test('危険文字を除去したファイル名へ正規化する', () => {
    expect(sanitizeFileName(' report:2026/02?.csv ')).toBe('report-2026-02-.csv');
  });

  test('空に潰れる場合はfallbackを使う', () => {
    expect(sanitizeFileName('..', { fallback: 'upload.txt' })).toBe('upload.txt');
  });

  test('許可拡張子を判定できる', () => {
    expect(hasAllowedFileExtension('sales-report.csv', ['csv', 'tsv'])).toBe(true);
    expect(hasAllowedFileExtension('malware.exe', ['csv', 'tsv'])).toBe(false);
  });
});

describe('createIdempotencyKey', () => {
  test('同一入力で同じキーを生成する', async () => {
    const payload = { userId: 'u1', amount: 1000 };
    const key1 = await createIdempotencyKey('PAYMENT', payload);
    const key2 = await createIdempotencyKey('PAYMENT', payload);
    expect(key1).toBe(key2);
    expect(key1.startsWith('payment:')).toBe(true);
  });

  test('scopeを正規化して制御文字を除去する', async () => {
    const key = await createIdempotencyKey('  PAY\r\nMENT  ', { a: 1 });
    expect(key.startsWith('payment:')).toBe(true);
  });

  test('payloadのキー順が異なっても同一キーになる', async () => {
    const key1 = await createIdempotencyKey('PAYMENT', { a: 1, b: 2 });
    const key2 = await createIdempotencyKey('PAYMENT', { b: 2, a: 1 });
    expect(key1).toBe(key2);
  });
});

describe('createRequestFingerprint', () => {
  test('同一内容なら同一fingerprint', async () => {
    const fp1 = await createRequestFingerprint({
      method: 'post',
      path: '/api/payments',
      body: { b: 2, a: 1 },
      query: { q: 'x' },
      userId: 'u1',
    });
    const fp2 = await createRequestFingerprint({
      method: 'POST',
      path: '/api/payments',
      body: { a: 1, b: 2 },
      query: { q: 'x' },
      userId: 'u1',
    });
    expect(fp1).toBe(fp2);
  });
});

describe('safeExternalRedirectUrl', () => {
  test('許可オリジンの外部URLを通す', () => {
    const actual = safeExternalRedirectUrl(
      'https://example.com/path',
      ['https://example.com'],
      '/fallback',
    );
    expect(actual).toBe('https://example.com/path');
  });

  test('未許可URLはフォールバック', () => {
    expect(
      safeExternalRedirectUrl('https://evil.com/path', ['https://example.com'], '/fallback'),
    ).toBe('/fallback');
  });
});
