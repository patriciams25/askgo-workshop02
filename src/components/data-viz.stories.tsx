import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bar, CountUp } from './ui'

const meta = {
  title: 'Eskgo/Visualização de dados',
  component: Bar,
  tags: ['autodocs'],
  args: { value: 68, color: 'var(--esk-lime)', h: 6 },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Bar>

export default meta
type Story = StoryObj<typeof meta>

export const BarraDeProgresso: Story = {
  render: (args) => <div className="w-[320px]"><Bar {...args} /></div>,
}

export const SaldoAnimado: Story = {
  render: () => <CountUp value={14500} format={(n) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`} />,
}
