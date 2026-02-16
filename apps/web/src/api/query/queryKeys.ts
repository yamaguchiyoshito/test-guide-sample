export const queryKeys = {
  auth: {
    profile: () => ['auth', 'profile'] as const,
  },
  users: {
    list: () => ['users', 'list'] as const,
    detail: (userId: string) => ['users', 'detail', userId] as const,
  },
};
