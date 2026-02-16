import { useQuery } from '@tanstack/react-query';
import { getUserDetail } from '@/api/clients/userClient';
import { queryKeys } from '@/api/query/queryKeys';

export function useUserDetailQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => getUserDetail(userId),
    enabled: userId.length > 0,
    staleTime: 60_000,
  });
}
