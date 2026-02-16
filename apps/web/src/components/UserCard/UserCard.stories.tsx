import type { Meta, StoryObj } from '@storybook/react';
import { UserCard } from './UserCard';

const meta: Meta<typeof UserCard> = {
  title: 'Components/UserCard',
  component: UserCard,
  args: {
    user: {
      id: 'u1',
      name: '山田 太郎',
      email: 'taro@example.com',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UserCard>;

export const Default: Story = {};

export const WithDeleteAction: Story = {
  args: {
    onDelete: (id: string) => {
      // Storybook上で挙動確認するための簡易ハンドラー
      console.log('delete', id);
    },
  },
};
