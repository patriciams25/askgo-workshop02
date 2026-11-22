import type { Meta, StoryObj } from '@storybook/react-vite'
import { GhostButton, PrimaryButton, RoundIconButton } from './ui'

const meta = {
  title: 'Eskgo/Controles/Botões',
  component: PrimaryButton,
  tags: ['autodocs'],
  args: { children: 'Continuar' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PrimaryButton>

export default meta
type Story = StoryObj<typeof meta>

export const Primario: Story = {}

export const Desativado: Story = {
  args: { disabled: true, children: 'Indisponível' },
}

export const Secundario: Story = {
  render: (args) => <GhostButton {...args} />,
  args: { children: 'Agora não' },
}

export const IconeRedondo: Story = {
  render: () => <RoundIconButton label="Adicionar" icon="plus" />,
}
