import type { User as ApiUser } from '@/api/contracts';

export type User = Pick<ApiUser, 'id' | 'name' | 'email'>;

interface UserCardProps {
  user: User;
  onDelete?: (id: string) => void;
}

export function UserCard({ user, onDelete }: UserCardProps) {
  return (
    <article
      aria-label="ユーザーカード"
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        padding: 16,
        display: 'grid',
        gap: 8,
        maxWidth: 360,
        background: '#ffffff',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>{user.name}</h2>
      <p style={{ margin: 0, color: '#475569' }}>{user.email}</p>
      {onDelete ? (
        <button type="button" onClick={() => onDelete(user.id)}>
          削除
        </button>
      ) : null}
    </article>
  );
}
