// @vitest-environment node

import { afterEach, describe, expect, test, vi } from 'vitest';
import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('logger', () => {
  test('LOG_LEVEL=warn のとき debug/info は出力しない', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'warn');
    vi.stubEnv('NEXT_PUBLIC_LOG_LEVEL', '');

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.debug('debug message', { event: 'test.debug' });
    logger.info('info message', { event: 'test.info' });
    logger.warn('warn message', { event: 'test.warn' });

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test('LOG_LEVEL=info のとき info/warn/error は出力する', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('NEXT_PUBLIC_LOG_LEVEL', '');

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug message', { event: 'test.debug' });
    logger.info('info message', { event: 'test.info' });
    logger.warn('warn message', { event: 'test.warn' });
    logger.error('error message', { event: 'test.error' });

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('非development環境では JSON 1行ログを出力し、機微情報を秘匿する', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('NEXT_PUBLIC_LOG_LEVEL', '');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('request completed', {
      event: 'http.client.request.succeeded',
      token: 'secret-token',
      email: 'user@example.com',
      requestId: 'req-001',
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logLine = infoSpy.mock.calls[0]?.[0];
    expect(typeof logLine).toBe('string');

    const parsed = JSON.parse(String(logLine)) as {
      timestamp: string;
      level: string;
      message: string;
      event: string;
      runtime: string;
      context: Record<string, unknown>;
    };

    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('level', 'info');
    expect(parsed).toHaveProperty('message', 'request completed');
    expect(parsed).toHaveProperty('event', 'http.client.request.succeeded');
    expect(parsed).toHaveProperty('runtime');
    expect(parsed).toHaveProperty('context');
    expect(parsed.context.token).toBe('[REDACTED]');
    expect(parsed.context.email).toBe('[REDACTED]');
  });
});
