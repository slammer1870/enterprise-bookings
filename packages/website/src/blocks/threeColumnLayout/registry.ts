// Server-safe module for block components registry
// This file is not marked as 'use client' so it can be imported from server components

import type React from 'react'

// Module-level registry for block components
// This is shared between server and client
let blockComponentsRegistry: Record<string, React.ComponentType<any> | ((props: any) => any)> | null = null

// Function for apps to register their block components
// Can be called from both server and client components
export const registerBlockComponents = (
  components: Record<string, React.ComponentType<any> | ((props: any) => any)>
) => {
  blockComponentsRegistry = components
}

// Function to get the registry (used by the Component)
export const getBlockComponentsRegistry = (): Record<string, React.ComponentType<any> | ((props: any) => any)> | null => {
  return blockComponentsRegistry
}
