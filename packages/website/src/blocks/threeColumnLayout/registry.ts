// Server-safe module for block components registry
// This file is not marked as 'use client' so it can be imported from server components

import type React from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = React.ComponentType<any>
type BlockLoader = () => Promise<AnyBlock>

// Module-level registry for block components (legacy sync consumers)
let blockComponentsRegistry: Record<string, AnyBlock | ((_props: any) => any)> | null = null

// Lazy loaders — preferred for code-splitting
let blockLoadersRegistry: Record<string, BlockLoader> | null = null

export const registerBlockComponents = (
  components: Record<string, AnyBlock | ((_props: any) => any)>,
) => {
  blockComponentsRegistry = components
}

export const registerBlockLoaders = (loaders: Record<string, BlockLoader>) => {
  blockLoadersRegistry = loaders
}

export const getBlockComponentsRegistry = (): Record<
  string,
  AnyBlock | ((_props: any) => any)
> | null => {
  return blockComponentsRegistry
}

export const getBlockLoadersRegistry = (): Record<string, BlockLoader> | null => {
  return blockLoadersRegistry
}

export async function resolveBlockComponent(blockType: string): Promise<AnyBlock | null> {
  const loader = blockLoadersRegistry?.[blockType]
  if (loader) return loader()
  const sync = blockComponentsRegistry?.[blockType]
  return sync ?? null
}
