import { generateRequestId } from '@/api/core/requestContext';
import { normalizeHeaderValue } from '@/lib/securityUtils';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const MAX_REQUEST_ID_LENGTH = 128;

/**
 * 目的: APIリクエストの相関IDを解決する。
 * 用途: 受信ヘッダ優先で採用し、未指定時は新規発行してログ追跡を安定化する。
 */
export function resolveRequestId(request: Request): string {
  const headerValue = request.headers.get(CORRELATION_ID_HEADER);
  if (typeof headerValue === 'string') {
    const normalized = normalizeHeaderValue(headerValue, MAX_REQUEST_ID_LENGTH).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return generateRequestId();
}
