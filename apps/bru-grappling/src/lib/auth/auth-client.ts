"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

// Helper function to get callback URL from current URL
export function getCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('callbackUrl') || '/dashboard';
  }
  return '/dashboard';
}

