import { delay, http, HttpResponse } from 'msw';
import { userFactory } from '@/tests/factories/userFactory';
import { getRequestScenario } from '@test-utils/msw/scenarios';

export const userHandlers = [
  http.get('/api/users/:id', async ({ params, request }) => {
    const scenario = getRequestScenario(request.headers);

    if (scenario === 'timeout') {
      await delay(16_000);
    }
    if (scenario === 'server-error') {
      return HttpResponse.json(
        { code: 'SERVER_ERROR', message: 'Mocked server error' },
        { status: 500 },
      );
    }
    if (scenario === 'not-found') {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Mocked not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json(userFactory.build({ id: String(params.id) }));
  }),
  http.get('/api/users', async ({ request }) => {
    const scenario = getRequestScenario(request.headers);

    if (scenario === 'timeout') {
      await delay(16_000);
    }
    if (scenario === 'server-error') {
      return HttpResponse.json(
        { code: 'SERVER_ERROR', message: 'Mocked server error' },
        { status: 500 },
      );
    }
    if (scenario === 'rate-limited') {
      return HttpResponse.json(
        { code: 'RATE_LIMITED', message: 'Mocked rate limit' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
    if (scenario === 'validation-error') {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Mocked validation error',
          fieldErrors: {
            keyword: ['キーワードは3文字以上で入力してください'],
          },
        },
        { status: 400 },
      );
    }

    return HttpResponse.json(userFactory.buildList(10));
  }),
];
