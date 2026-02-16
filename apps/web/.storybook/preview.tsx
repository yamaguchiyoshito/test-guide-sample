import type { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/tests/msw/handlers';
import { applyStorybookMockScenario } from '@test-utils/msw/storybookScenario';
import { isMockScenario } from '@test-utils/msw/scenarios';

initialize({ onUnhandledRequest: 'warn' });

const preview: Preview = {
  globalTypes: {
    mockScenario: {
      name: 'Mock Scenario',
      description: 'MSW response scenario',
      defaultValue: 'default',
      toolbar: {
        icon: 'database',
        items: [
          { value: 'default', title: 'default' },
          { value: 'server-error', title: '500' },
          { value: 'rate-limited', title: '429' },
          { value: 'timeout', title: 'timeout' },
          { value: 'validation-error', title: 'validation' },
          { value: 'not-found', title: '404' },
        ],
        showName: true,
      },
    },
  },
  parameters: {
    msw: { handlers },
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const scenario = String(context.globals.mockScenario || 'default');
      applyStorybookMockScenario(isMockScenario(scenario) ? scenario : 'default');
      return <Story />;
    },
  ],
  loaders: [mswLoader],
};

export default preview;
