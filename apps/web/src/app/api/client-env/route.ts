import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ErrorResponse } from '@/api/contracts';
import { logger } from '@/api/core/logger';
import { resolveRequestId } from '@/app/api/_lib/requestId';
import {
  enforceMaxBodySize,
  extractClientIp,
  normalizeHeaderValue,
  safeJsonParseWithSchema,
  validateContentType,
} from '@/lib/securityUtils';

const MAX_CLIENT_ENV_BODY_BYTES = 8 * 1024;

const ClientEnvironmentSchema = z.object({
  userAgent: z.string().max(2048),
  language: z.string().max(64),
  languages: z.array(z.string().max(64)).max(10),
  platform: z.string().max(128).nullable(),
  timezone: z.string().max(128).nullable(),
  cookieEnabled: z.boolean(),
  doNotTrack: z.string().max(32).nullable(),
  online: z.boolean(),
  viewport: z.object({
    width: z.number().int().nonnegative().max(10000),
    height: z.number().int().nonnegative().max(10000),
  }),
  screen: z.object({
    width: z.number().int().nonnegative().max(20000),
    height: z.number().int().nonnegative().max(20000),
    availWidth: z.number().int().nonnegative().max(20000),
    availHeight: z.number().int().nonnegative().max(20000),
  }),
  devicePixelRatio: z.number().nonnegative().max(16).nullable(),
  hardwareConcurrency: z.number().nonnegative().max(1024).nullable(),
  deviceMemory: z.number().nonnegative().max(1024).nullable(),
  maxTouchPoints: z.number().int().nonnegative().max(128),
  connection: z
    .object({
      effectiveType: z.string().max(32).nullable(),
      downlink: z.number().nonnegative().max(10000).nullable(),
      rtt: z.number().nonnegative().max(60000).nullable(),
      saveData: z.boolean().nullable(),
    })
    .nullable(),
  path: z.string().min(1).max(512),
  referrerOrigin: z.string().max(512).nullable(),
  capturedAt: z.string().datetime(),
});

const ClientEnvironmentLogSchema = z.object({
  event: z.literal('client_environment'),
  requestId: z.string().min(1).max(128),
  source: z.string().min(1).max(128),
  environment: ClientEnvironmentSchema,
});

export async function POST(request: Request) {
  const fallbackRequestId = resolveRequestId(request);

  if (!validateContentType(request, ['application/json'])) {
    const errorBody: ErrorResponse = {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Content-Type は application/json を指定してください',
    };
    return NextResponse.json(errorBody, { status: 415 });
  }

  const rawBody = await request.text();
  if (!enforceMaxBodySize(rawBody, MAX_CLIENT_ENV_BODY_BYTES)) {
    const errorBody: ErrorResponse = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'リクエストボディが大きすぎます',
    };
    return NextResponse.json(errorBody, { status: 413 });
  }

  const parsedBody = safeJsonParseWithSchema(rawBody, ClientEnvironmentLogSchema);
  if (!parsedBody.ok) {
    logger.warn('Client environment log rejected by schema validation', {
      event: 'api.client_env.rejected',
      requestId: fallbackRequestId,
      clientIp: extractClientIp(request),
      issues: parsedBody.issues,
    });

    const errorBody: ErrorResponse = {
      code: 'INVALID_REQUEST',
      message: 'クライアント環境情報の形式が不正です',
    };
    return NextResponse.json(errorBody, { status: 400 });
  }

  const payloadRequestId = normalizeHeaderValue(parsedBody.data.requestId, 128).trim();
  const requestId = payloadRequestId.length > 0 ? payloadRequestId : fallbackRequestId;

  logger.info('Client environment log accepted', {
    event: 'api.client_env.accepted',
    requestId,
    clientIp: extractClientIp(request),
    source: parsedBody.data.source,
    payloadEvent: parsedBody.data.event,
    environment: parsedBody.data.environment,
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
