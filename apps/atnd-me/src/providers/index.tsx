import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { TRPCReactProvider } from '@repo/trpc'
import { BetterAuthProvider } from '@/lib/auth/context'
import { getContextProps } from '@/lib/auth/context/get-context-props'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const contextProps = getContextProps()

  return (
    <BetterAuthProvider {...contextProps}>
      <TRPCReactProvider>
        <ThemeProvider>
          <HeaderThemeProvider>{children}</HeaderThemeProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </BetterAuthProvider>
  )
}
