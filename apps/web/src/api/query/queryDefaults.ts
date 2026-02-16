import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/api/core/apiError';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry(failureCount, error) {
          if (isApiError(error)) {
            return error.retryable && failureCount < 2;
          }
          return false;
        },
      },
    },
  });
}
