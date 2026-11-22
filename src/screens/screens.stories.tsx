import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Home as HomeScreen } from './Home'
import { Cartoes as CartoesScreen } from './Cartoes'
import { Metas as MetasScreen } from './Metas'
import { Fatura as FaturaScreen } from './Fatura'
import { Assistente as AssistenteScreen } from './Assistente'
import { StoreProvider } from '../store'
import type { Nav } from '../App'

const nav: Nav = {
  go: () => undefined,
  back: () => undefined,
  sheet: () => undefined,
  toast: () => undefined,
}

function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="min-h-dvh bg-esk-bg text-esk-text">
        <main className="mx-auto w-full max-w-[440px] px-4 pb-10 pt-8 lg:max-w-[1180px] lg:px-6 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
    </StoreProvider>
  )
}

const meta = {
  title: 'Eskgo/Telas',
  component: HomeScreen,
  args: { nav },
  decorators: [(Story) => <ScreenFrame><Story /></ScreenFrame>],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HomeScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Inicio: Story = { render: () => <HomeScreen nav={nav} /> }
export const Cartoes: Story = { render: () => <CartoesScreen nav={nav} /> }
export const Metas: Story = { render: () => <MetasScreen nav={nav} /> }
export const Fatura: Story = { render: () => <FaturaScreen nav={nav} /> }
export const Assistente: Story = { render: () => <AssistenteScreen nav={nav} /> }
