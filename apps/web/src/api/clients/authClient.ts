import { z } from 'zod';
import { requestJson } from '@/api/core/httpClient';
import type { LoginRequest, LoginResponse } from '@/api/contracts';

const LoginResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export async function loginWithPassword(payload: LoginRequest): Promise<LoginResponse> {
  const response = await requestJson<LoginResponse, LoginRequest>(
    '/api/login',
    {
      method: 'POST',
      body: payload,
      withAuth: false,
      debugContext: {
        page: 'login',
        action: 'login',
      },
    },
    LoginResponseSchema,
  );

  return response.data;
}
