"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";

export type SignInWithGoogle = (_callbackURL: string) => Promise<void>;

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"
      />
      <path
        fill="#EA4335"
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"
      />
    </svg>
  );
}

type GoogleSignInButtonProps = {
  callbackURL: string;
  /** When provided (e.g. from Better Auth context), enables the button. Omit to hide. */
  signInWithGoogle?: SignInWithGoogle | null;
  /** "Login" for login tab, "Continue" for register tab */
  variant?: "login" | "register";
  className?: string;
};

export function GoogleSignInButton({
  callbackURL,
  signInWithGoogle,
  variant = "login",
  className,
}: GoogleSignInButtonProps) {
  const [isPending, setIsPending] = useState(false);

  if (!signInWithGoogle) return null;

  const label =
    variant === "login" ? "Login with Google" : "Continue with Google";

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "w-full"}
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        try {
          await signInWithGoogle(callbackURL);
        } finally {
          setIsPending(false);
        }
      }}
    >
      <GoogleLogo className="mr-2 shrink-0" />
      {isPending ? "Redirecting…" : label}
    </Button>
  );
}
