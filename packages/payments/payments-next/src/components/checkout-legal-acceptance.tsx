"use client";

import type { ReactNode } from "react";
import type { CheckoutLegalConfig } from "../types/checkout-legal";

type CheckoutLegalAcceptanceProps = {
  config: CheckoutLegalConfig;
};

function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4"
    >
      {children}
    </a>
  );
}

function formatLinkList(links: CheckoutLegalConfig["links"]): ReactNode[] {
  return links.flatMap((link, index) => {
    const separator =
      index === 0 ? null : index === links.length - 1 ? " and " : ", ";

    return [
      separator,
      <LegalLink key={link.href} href={link.href}>
        {link.label}
      </LegalLink>,
    ].filter((part) => part != null);
  });
}

export function CheckoutLegalAcceptance({ config }: CheckoutLegalAcceptanceProps) {
  const links = config.links.filter((link) => link.href && link.label);

  if (links.length === 0) return null;

  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="checkout-legal-acceptance"
    >
      By placing your booking, you agree to our {formatLinkList(links)}.
    </p>
  );
}
