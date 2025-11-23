"use client";

import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "./client";
import { Suspense } from "react";

function AuthUIProviderContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle session change with callback URL redirect
  const handleSessionChange = () => {
    const callbackUrl = searchParams?.get('callbackUrl');
    if (callbackUrl) {
      router.push(callbackUrl);
    } else {
      router.refresh();
    }
  };

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={handleSessionChange}
      Link={Link}
    >
      {children}
    </AuthUIProvider>
  );
}

export function BetterAuthUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>{children}</div>}>
      <AuthUIProviderContent>{children}</AuthUIProviderContent>
    </Suspense>
  );
}

