import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { setupTestMsw } from '@test-utils/msw/setupTestMsw';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';

setupTestMsw(
  server,
  {
    lifecycle: {
      beforeAll,
      afterEach,
      afterAll,
    },
    cleanup,
    clearMocks: () => {
      vi.clearAllMocks();
    },
  },
  { onUnhandledRequest: 'error' },
);
