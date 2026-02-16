import { NextResponse } from 'next/server';
import { logger } from '@/api/core/logger';
import { resolveRequestId } from '@/app/api/_lib/requestId';
import {
  buildSecureSetCookieHeader,
  createSecureToken,
  isValidCsrfTokenFormat,
} from '@/lib/securityUtils';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_TOKEN_BYTES = 24;
const CSRF_TOKEN_MAX_AGE_SECONDS = 60 * 60;

function isSecureCookieRequired(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const token = createSecureToken(CSRF_TOKEN_BYTES);

  if (!isValidCsrfTokenFormat(token)) {
    logger.error('CSRF token generation failed', {
      event: 'api.csrf.failed',
      requestId,
      path: request.url,
    });

    return NextResponse.json(
      {
        code: 'SERVER_ERROR',
        message: 'CSRFトークンの生成に失敗しました',
      },
      { status: 500 },
    );
  }

  const setCookieValue = buildSecureSetCookieHeader(CSRF_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: isSecureCookieRequired(),
    sameSite: 'Lax',
    maxAgeSeconds: CSRF_TOKEN_MAX_AGE_SECONDS,
  });

  logger.info('CSRF token issued', {
    event: 'api.csrf.issued',
    requestId,
    path: request.url,
  });

  return NextResponse.json(
    { csrfToken: token },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': setCookieValue,
      },
    },
  );
}
