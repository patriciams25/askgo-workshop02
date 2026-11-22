import type { Meta, StoryObj } from '@storybook/react-vite'
import { CATEGORY_ICON, Icon } from './Icon'

const meta = {
  title: 'Eskgo/Ícones',
  component: Icon,
  tags: ['autodocs'],
  args: { name: 'home', size: 24 },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Moradia: Story = { args: { name: CATEGORY_ICON.moradia } }

export const Categorias: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-5">
      {Object.entries(CATEGORY_ICON).map(([category, name]) => (
        <div key={category} className="flex items-center gap-3 rounded-2xl bg-esk-surface p-4 text-esk-text">
          <Icon name={name} />
          <span className="text-sm capitalize">{category}</span>
        </div>
      ))}
    </div>
  ),
}
