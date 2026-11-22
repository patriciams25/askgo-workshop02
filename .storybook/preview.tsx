import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'Eskgo',
      values: [
        { name: 'Eskgo', value: '#030303' },
        { name: 'Surface', value: '#111111' },
        { name: 'White', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
