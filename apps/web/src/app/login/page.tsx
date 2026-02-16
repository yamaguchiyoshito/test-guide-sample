'use client';

import { FormEvent, useState } from 'react';
import { isApiError } from '@/api/core/apiError';
import { useLoginMutation } from '@/api/hooks/auth/useLoginMutation';
import type { LoginRequest } from '@/api/contracts';
import { normalizeEmail, toErrorMessage } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('未ログイン');
  const loginMutation = useLoginMutation();

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail.length > 0 && password.length > 0) {
      const payload: LoginRequest = { email: normalizedEmail, password };

      try {
        await loginMutation.mutateAsync(payload);
        setMessage('ログイン成功');
      } catch (error) {
        if (isApiError(error)) {
          setMessage(`ログインに失敗しました（${error.code}）`);
        } else {
          setMessage(`ログインに失敗しました（${toErrorMessage(error, 'UNKNOWN_ERROR')}）`);
        }
      }

      return;
    }

    setMessage('メールアドレスとパスワードを入力してください');
  };

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>ログイン</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? '送信中...' : 'ログイン'}
        </button>
      </form>

      <p role="status" aria-live="polite" style={{ marginTop: 16 }}>
        {message}
      </p>
    </main>
  );
}
