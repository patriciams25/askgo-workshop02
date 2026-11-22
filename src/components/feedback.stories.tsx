import type { Meta, StoryObj } from '@storybook/react-vite'
import { Empty, Toast } from './ui'

const meta = {
  title: 'Eskgo/Feedback',
  component: Empty,
  tags: ['autodocs'],
  args: { title: 'Nenhuma compra por aqui', hint: 'Suas movimentações vão aparecer nesta lista.' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const EstadoVazio: Story = {
  args: { title: 'Nenhuma compra por aqui', hint: 'Suas movimentações vão aparecer nesta lista.' },
}

export const ToastDeSucesso: Story = {
  render: () => <Toast message="Compra adicionada" />,
  parameters: { layout: 'fullscreen' },
}
