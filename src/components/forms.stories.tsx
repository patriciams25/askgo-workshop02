import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field, Sheet, inputCls } from './ui'

const meta = {
  title: 'Eskgo/Controles/Formulários',
  component: Field,
  tags: ['autodocs'],
  args: { label: 'E-mail', children: null },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Campo: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Field {...args}>
        <input className={inputCls} type="email" placeholder="voce@exemplo.com" />
      </Field>
    </div>
  ),
}

export const CampoComErro: Story = {
  ...Campo,
  args: { label: 'E-mail', error: 'Digite um e-mail válido', children: null },
}

export const Folha: Story = {
  render: () => (
    <div className="h-[600px] w-[380px]">
      <Sheet title="Adicionar compra" onClose={() => undefined}>
        <div className="flex flex-col gap-5">
          <Field label="Descrição"><input className={inputCls} placeholder="Ex.: Mercado" /></Field>
          <Field label="Valor"><input className={inputCls} placeholder="R$ 0,00" /></Field>
        </div>
      </Sheet>
    </div>
  ),
  parameters: { layout: 'fullscreen' },
}
