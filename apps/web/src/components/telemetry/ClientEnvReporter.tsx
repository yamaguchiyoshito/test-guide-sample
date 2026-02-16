'use client';

import { useEffect } from 'react';
import { logClientEnvironment } from '@/lib/clientEnvLogger';

function isClientEnvLogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CLIENT_ENV_LOG === 'true';
}

/**
 * 目的: クライアント起動時にブラウザ環境ログ送信を開始する。
 * 用途: レイアウト単位で1回だけ実行し、画面ごとの重複送信を防ぐ。
 */
export function ClientEnvReporter() {
  useEffect(() => {
    if (!isClientEnvLogEnabled()) {
      return;
    }

    void logClientEnvironment({
      source: 'layout_mount',
    });
  }, []);

  return null;
}
