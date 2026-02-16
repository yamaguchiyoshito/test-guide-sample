import { useMutation } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse } from '@/api/contracts';
import { loginWithPassword } from '@/api/clients/authClient';

export function useLoginMutation() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationKey: ['auth', 'login'],
    mutationFn: (payload) => loginWithPassword(payload),
  });
}
