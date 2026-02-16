import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { renderWithAppProviders } from '@/tests/utils/reactTestUtils';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  test('ユーザー名とメールアドレスを表示する', () => {
    renderWithAppProviders(
      <UserCard
        user={{ id: 'u1', name: '山田 太郎', email: 'taro@example.com' }}
      />,
    );

    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('taro@example.com')).toBeInTheDocument();
  });

  test('削除ボタンクリックでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    renderWithAppProviders(
      <UserCard
        user={{ id: 'u2', name: '佐藤 花子', email: 'hanako@example.com' }}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('u2');
  });
});
