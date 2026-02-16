'use client';

import { useUsersQuery } from '@/api/hooks/users/useUsersQuery';
import { isApiError } from '@/api/core/apiError';
import { UserCard } from '@/components/UserCard/UserCard';

export default function HomePage() {
  const usersQuery = useUsersQuery();

  return (
    <main style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Test Guide Scaffold</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Vitest / Storybook / Playwright の最小サンプルを配置しています。
      </p>

      {usersQuery.isPending ? (
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          ユーザーを取得中です
        </p>
      ) : null}

      {usersQuery.isError ? (
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          {isApiError(usersQuery.error)
            ? `ユーザー取得に失敗しました（${usersQuery.error.code}）`
            : 'ユーザー取得に失敗しました'}
        </p>
      ) : null}

      {(usersQuery.data || []).map((user) => (
        <UserCard
          key={user.id}
          user={{ id: user.id, name: user.name, email: user.email }}
        />
      ))}
    </main>
  );
}
