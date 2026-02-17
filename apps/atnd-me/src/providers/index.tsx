import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { TRPCReactProvider } from '@repo/trpc'
import { BetterAuthProvider } from '@/lib/auth/context'
import { BetterAuthUIProvider } from '@/lib/auth/provider'
import { getContextProps } from '@/lib/auth/context/get-context-props'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const contextProps = getContextProps()

  return (
    <BetterAuthProvider {...contextProps}>
      <TRPCReactProvider>
        <ThemeProvider>
          <HeaderThemeProvider>
            <BetterAuthUIProvider>{children}</BetterAuthUIProvider>
          </HeaderThemeProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </BetterAuthProvider>
  )
}
