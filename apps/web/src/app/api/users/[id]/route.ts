import { NextResponse } from 'next/server';
import type { ErrorResponse } from '@/api/contracts';
import { logger } from '@/api/core/logger';
import { demoUsers } from '@/app/api/_data/users';
import { resolveRequestId } from '@/app/api/_lib/requestId';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const requestId = resolveRequestId(_request);
  const { id } = await params;
  const user = demoUsers.find((item) => item.id === id);

  if (!user) {
    logger.warn('User detail not found', {
      event: 'api.users.detail_not_found',
      requestId,
      userId: id,
      path: _request.url,
    });

    const errorBody: ErrorResponse = {
      code: 'NOT_FOUND',
      message: `id=${id} のユーザーは存在しません`,
    };

    return NextResponse.json(errorBody, { status: 404 });
  }

  logger.info('User detail found', {
    event: 'api.users.detail_found',
    requestId,
    userId: id,
    path: _request.url,
  });

  return NextResponse.json(user, { status: 200 });
}
