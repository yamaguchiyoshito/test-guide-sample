import { describe, expect, test, vi } from 'vitest';
import {
  buildPath,
  decodeJwtPayload,
  getJwtExpMs,
  isAbortError,
  normalizeEmail,
  omitNil,
  omitUndefined,
  parseRetryAfterMs,
  safeJsonParse,
  safeJsonStringify,
  serializeError,
  toErrorMessage,
  toQueryString,
  withTimeout,
} from './utils';

describe('normalizeEmail', () => {
  test('空白と大文字を正規化する', () => {
    expect(normalizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
  });
});

describe('toQueryString', () => {
  test('undefined/null/空配列を除外してクエリ化する', () => {
    const query = toQueryString({
      q: 'abc',
      page: 2,
      draft: false,
      empty: undefined,
      nil: null,
      tags: ['x', 'y'],
      none: [],
    });
    expect(query).toBe('?q=abc&page=2&draft=false&tags=x&tags=y');
  });
});

describe('omitUndefined', () => {
  test('undefinedのみを除外する', () => {
    const input = {
      a: 1,
      b: undefined,
      c: null,
      d: 'x',
    };
    expect(omitUndefined(input)).toEqual({
      a: 1,
      c: null,
      d: 'x',
    });
  });
});

describe('omitNil', () => {
  test('null/undefinedを除外する', () => {
    const input = {
      a: 1,
      b: undefined,
      c: null,
      d: false,
      e: '',
    };
    expect(omitNil(input)).toEqual({
      a: 1,
      d: false,
      e: '',
    });
  });
});

describe('safeJsonParse', () => {
  test('正常JSONをok=trueで返す', () => {
    const result = safeJsonParse<{ name: string }>('{"name":"alice"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('alice');
    }
  });

  test('不正JSONをok=falseで返す', () => {
    const result = safeJsonParse('{"name":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});

describe('serializeError', () => {
  test('Errorインスタンスを構造化する', () => {
    const error = new Error('failure');
    const serialized = serializeError(error);
    expect(serialized.message).toBe('failure');
    expect(serialized.name).toBe('Error');
  });

  test('オブジェクト例外を安全に構造化する', () => {
    const serialized = serializeError({ message: 'oops', code: 500 });
    expect(serialized.message).toBe('oops');
  });
});

describe('toErrorMessage', () => {
  test('Errorからメッセージを抽出する', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('空メッセージ時はfallbackを返す', () => {
    expect(toErrorMessage({ message: '   ' }, 'fallback')).toBe('fallback');
  });
});

describe('buildPath', () => {
  test('パスパラメータをエンコードして埋め込む', () => {
    expect(buildPath('/api/users/:id/files/:name', { id: 'a/b', name: 'x y' })).toBe(
      '/api/users/a%2Fb/files/x%20y',
    );
  });

  test('不足パラメータ時は例外を投げる', () => {
    expect(() => buildPath('/api/users/:id', {} as Record<string, string>)).toThrow(
      'Missing path parameter: id',
    );
  });
});

describe('decodeJwtPayload/getJwtExpMs', () => {
  function createJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const body = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `${header}.${body}.signature`;
  }

  test('payloadをデコードできる', () => {
    const token = createJwt({ exp: 1700000000, sub: 'u1' });
    expect(decodeJwtPayload<{ exp: number; sub: string }>(token)).toEqual({
      exp: 1700000000,
      sub: 'u1',
    });
  });

  test('不正トークンはnullを返す', () => {
    expect(decodeJwtPayload('invalid-token')).toBeNull();
  });

  test('expをミリ秒に変換する', () => {
    const token = createJwt({ exp: 1700000000 });
    expect(getJwtExpMs(token)).toBe(1700000000 * 1000);
  });

  test('exp未定義はnullを返す', () => {
    const token = createJwt({ sub: 'u1' });
    expect(getJwtExpMs(token)).toBeNull();
  });
});

describe('safeJsonStringify', () => {
  test('JSON文字列化できる値を返す', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
  });

  test('循環参照はfallbackを返す', () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(safeJsonStringify(value, 'fallback')).toBe('fallback');
  });
});

describe('parseRetryAfterMs', () => {
  test('秒指定をミリ秒に変換する', () => {
    expect(parseRetryAfterMs('60')).toBe(60000);
  });

  test('HTTP-date指定を現在時刻との差分ミリ秒に変換する', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-16T00:00:00Z').getTime());
    try {
      const value = parseRetryAfterMs('Mon, 16 Feb 2026 00:00:30 GMT');
      expect(value).toBe(30000);
    } finally {
      vi.restoreAllMocks();
    }
  });

  test('不正値はundefinedを返す', () => {
    expect(parseRetryAfterMs('xxx')).toBeUndefined();
    expect(parseRetryAfterMs(null)).toBeUndefined();
  });
});

describe('isAbortError', () => {
  test('AbortError名のErrorをtrue判定する', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  test('通常エラーはfalse判定する', () => {
    expect(isAbortError(new Error('normal'))).toBe(false);
  });
});

describe('withTimeout', () => {
  test('制限時間内のPromiseを解決する', async () => {
    const value = await withTimeout(Promise.resolve('ok'), 100);
    expect(value).toBe('ok');
  });

  test('タイムアウト時はErrorでrejectする', async () => {
    await expect(
      withTimeout(
        new Promise<string>((resolve) => setTimeout(() => resolve('late'), 30)),
        1,
        'timeout',
      ),
    ).rejects.toThrow('timeout');
  });
});
