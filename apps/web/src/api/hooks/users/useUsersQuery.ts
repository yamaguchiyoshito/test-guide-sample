import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/api/clients/userClient';
import { queryKeys } from '@/api/query/queryKeys';

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => getUsers(),
    staleTime: 60_000,
  });
}
