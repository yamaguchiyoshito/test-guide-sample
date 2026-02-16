import { NextResponse } from 'next/server';
import { logger } from '@/api/core/logger';
import { demoUsers } from '@/app/api/_data/users';
import { resolveRequestId } from '@/app/api/_lib/requestId';

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  logger.info('Users listed', {
    event: 'api.users.listed',
    requestId,
    count: demoUsers.length,
    path: request.url,
  });

  return NextResponse.json(demoUsers, { status: 200 });
}
