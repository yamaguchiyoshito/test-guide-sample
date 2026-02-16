import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRequestId } from './requestId';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRequestId', () => {
  test('X-Correlation-IDヘッダがある場合はその値を返す', () => {
    const request = new Request('https://example.com/api/users', {
      headers: {
        'X-Correlation-ID': 'req-001',
      },
    });

    expect(resolveRequestId(request)).toBe('req-001');
  });

  test('ヘッダが空の場合は新規IDを生成する', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-request-id');
    const request = new Request('https://example.com/api/users', {
      headers: {
        'X-Correlation-ID': '   ',
      },
    });

    expect(resolveRequestId(request)).toBe('generated-request-id');
  });

  test('制御文字を含むヘッダ値は正規化して返す', () => {
    const request = {
      headers: {
        get: () => 'req-\u0000id-\u001F001',
      },
    } as unknown as Request;

    expect(resolveRequestId(request)).toBe('req-id-001');
  });
});
