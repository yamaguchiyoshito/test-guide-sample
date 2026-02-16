import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/api/query/QueryProvider';
import { ClientEnvReporter } from '@/components/telemetry/ClientEnvReporter';
import './globals.css';

export const metadata: Metadata = {
  title: 'Test Guide Web',
  description: 'Minimal scaffold for test automation examples',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <ClientEnvReporter />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
