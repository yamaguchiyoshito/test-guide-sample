import { z } from 'zod';
import { requestJson } from '@/api/core/httpClient';
import type { User } from '@/api/contracts';
import { buildPath } from '@/lib/utils';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().nonnegative(),
  role: z.enum(['user', 'admin', 'guest']),
});

const UsersSchema = z.array(UserSchema);

export async function getUsers(): Promise<User[]> {
  const response = await requestJson<User[]>(
    '/api/users',
    {
      method: 'GET',
      withAuth: false,
      debugContext: {
        page: 'home',
        action: 'list-users',
      },
    },
    UsersSchema,
  );

  return response.data;
}

export async function getUserDetail(userId: string): Promise<User> {
  const response = await requestJson<User>(
    buildPath('/api/users/:userId', { userId }),
    {
      method: 'GET',
      withAuth: false,
      debugContext: {
        page: 'user-detail',
        action: 'get-user',
      },
    },
    UserSchema,
  );

  return response.data;
}
