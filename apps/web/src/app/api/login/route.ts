import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ErrorResponse, LoginResponse } from '@/api/contracts';
import { logger } from '@/api/core/logger';
import { resolveRequestId } from '@/app/api/_lib/requestId';
import { normalizeEmail } from '@/lib/utils';
import {
  enforceMaxBodySize,
  extractClientIp,
  getCookieValue,
  isValidCsrfTokenFormat,
  safeJsonParseWithSchema,
  validateContentType,
  validateRequestOrigin,
  verifyCsrfDoubleSubmit,
} from '@/lib/securityUtils';

const LoginBodySchema = z.object({
  email: z.string(),
  password: z.string(),
});

const NormalizedEmailSchema = z.string().email();
const MAX_LOGIN_BODY_BYTES = 8 * 1024;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isValidCsrfRequest(request: Request): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = getCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken) {
    return false;
  }

  if (!isValidCsrfTokenFormat(headerToken) || !isValidCsrfTokenFormat(cookieToken)) {
    return false;
  }

  return verifyCsrfDoubleSubmit(cookieToken, headerToken);
}

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const clientIp = extractClientIp(request);
  const allowedOrigins = getAllowedOrigins();

  if (!validateRequestOrigin(request, allowedOrigins)) {
    logger.warn('Login rejected by origin validation', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    });

    const errorBody: ErrorResponse = {
      code: 'FORBIDDEN',
      message: '許可されていないオリジンです',
    };

    return NextResponse.json(errorBody, { status: 403 });
  }

  if (!validateContentType(request, ['application/json'])) {
    logger.warn('Login rejected by content-type validation', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      contentType: request.headers.get('content-type'),
    });

    const errorBody: ErrorResponse = {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Content-Type は application/json を指定してください',
    };

    return NextResponse.json(errorBody, { status: 415 });
  }

  if (!isValidCsrfRequest(request)) {
    logger.warn('Login rejected by CSRF validation', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      hasCsrfHeader: Boolean(request.headers.get(CSRF_HEADER_NAME)),
      hasCookie: Boolean(request.headers.get('cookie')),
    });

    const errorBody: ErrorResponse = {
      code: 'FORBIDDEN',
      message: 'CSRFトークンが不正です',
    };

    return NextResponse.json(errorBody, { status: 403 });
  }

  const rawBody = await request.text();
  if (!enforceMaxBodySize(rawBody, MAX_LOGIN_BODY_BYTES)) {
    logger.warn('Login rejected by payload size', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      bodySizeBytes: new TextEncoder().encode(rawBody).byteLength,
      maxBodyBytes: MAX_LOGIN_BODY_BYTES,
    });

    const errorBody: ErrorResponse = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'リクエストボディが大きすぎます',
    };

    return NextResponse.json(errorBody, { status: 413 });
  }

  const parsedBody = safeJsonParseWithSchema(rawBody, LoginBodySchema);

  if (!parsedBody.ok) {
    logger.warn('Login rejected by invalid request body', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      issues: parsedBody.issues,
    });

    const errorBody: ErrorResponse = {
      code: 'INVALID_REQUEST',
      message: 'リクエストボディの形式が不正です',
    };

    return NextResponse.json(errorBody, { status: 400 });
  }

  const email = normalizeEmail(parsedBody.data.email);
  const password = parsedBody.data.password;
  const isEmailValid = NormalizedEmailSchema.safeParse(email).success;

  if (!isEmailValid || password.length < 8) {
    logger.warn('Login rejected by credentials validation', {
      event: 'api.login.rejected',
      requestId,
      clientIp,
      isEmailValid,
      passwordLength: password.length,
    });

    const errorBody: ErrorResponse = {
      code: 'INVALID_CREDENTIALS',
      message: 'メールアドレスと8文字以上のパスワードを指定してください',
    };

    return NextResponse.json(errorBody, { status: 400 });
  }

  const responseBody: LoginResponse = {
    token: 'demo-jwt-token',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };

  logger.info('Login accepted', {
    event: 'api.login.accepted',
    requestId,
    clientIp,
  });

  return NextResponse.json(responseBody, { status: 200 });
}
