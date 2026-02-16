import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { createTestQueryClient } from '@test-utils/react/createTestQueryClient';
import { renderWithProviders } from '@test-utils/react/renderWithProviders';
import type { ProviderWrapper } from '@test-utils/react/withTestProviders';
import type { ReactElement } from 'react';

export function createReactQueryTestClient(): QueryClient {
  return createTestQueryClient(QueryClient);
}

export function renderWithAppProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {},
) {
  const queryClient = createReactQueryTestClient();

  const wrappers: ProviderWrapper<ReactElement>[] = [
    (node) => <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  ];

  const result = renderWithProviders(render, ui, wrappers, options);
  return {
    ...result,
    queryClient,
  };
}
