import type { StorybookConfig } from '@storybook/nextjs';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  webpackFinal: async (cfg) => {
    if (cfg.resolve) {
      cfg.resolve.alias = {
        ...cfg.resolve.alias,
        '@': path.resolve(__dirname, '../src'),
        '@test-utils': path.resolve(__dirname, '../../packages/test-utils/src'),
      };
    }
    return cfg;
  },
};

export default config;
