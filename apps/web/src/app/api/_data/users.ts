import type { User } from '@/api/contracts';

export const demoUsers: User[] = [
  {
    id: 'u_001',
    name: '山田 太郎',
    email: 'taro@example.com',
    age: 30,
    role: 'user',
  },
  {
    id: 'u_002',
    name: '佐藤 花子',
    email: 'hanako@example.com',
    age: 27,
    role: 'admin',
  },
  {
    id: 'u_003',
    name: '鈴木 一郎',
    email: 'ichiro@example.com',
    age: 35,
    role: 'guest',
  },
];
