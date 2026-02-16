import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './openapi.yaml',
    output: {
      mode: 'single',
      target: './src/generated/api.ts',
      schemas: './src/generated/model',
      client: 'fetch',
      clean: true,
    },
  },
});
