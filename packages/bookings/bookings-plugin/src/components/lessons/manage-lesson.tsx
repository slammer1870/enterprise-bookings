"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Edit2Icon, Link2Icon, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { DeleteLesson } from "./delete-lesson";

function getTenantSlugFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/tenant-slug=([^;]+)/);
  const value = match?.[1];
  return value ? decodeURIComponent(value.trim()) : null;
}

function getRootHostFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0] ?? null;
  }
}

function shouldPrefixWithTenantSlug(
  hostname: string,
  tenantSlug: string,
  rootHost: string | null
): boolean {
  const hasTenantSubdomain = hostname === tenantSlug || hostname.startsWith(`${tenantSlug}.`);
  if (hasTenantSubdomain) return false;

  if (!rootHost) return true;
  return hostname === rootHost || hostname.endsWith(`.${rootHost}`);
}

function getPublicBookingUrl(
  lessonId: number,
  tenantSlugFromLesson: string | null | undefined
): string {
  if (typeof window === "undefined") return "";
  const tenantSlug =
    tenantSlugFromLesson ?? getTenantSlugFromCookie();
  const path = `/bookings/${lessonId}`;
  if (tenantSlug) {
    const { protocol, hostname, port } = window.location;
    const rootHost = getRootHostFromEnv();
    const shouldPrefix = shouldPrefixWithTenantSlug(
      hostname,
      tenantSlug,
      rootHost
    );
    const host = shouldPrefix
      ? `${tenantSlug}.${hostname}`
      : hostname;
    const hostWithPort = port ? `${host}:${port}` : host;
    return `${protocol}//${hostWithPort}${path}`;
  }
  return `${window.location.origin}${path}`;
}

/**
 * Actions dropdown for a lesson row. Uses a native button as trigger so Radix
 * can attach ref and open the menu (Payload Button does not forward ref).
 */
export const ManageLesson = ({
  lessonId,
  tenantSlug,
}: {
  lessonId: number;
  tenantSlug?: string | null;
}) => {
  const pathname = usePathname();
  const collectionBasePath =
    pathname && pathname.startsWith("/admin/collections/")
      ? pathname
      : "/admin/collections/lessons";

  const handleCopyBookingLink = async () => {
    const url = getPublicBookingUrl(lessonId, tenantSlug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Booking link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Open lesson actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100]">
        <DropdownMenuItem asChild>
          <Link
            href={`${collectionBasePath}/${lessonId}`}
            className="flex items-center gap-2"
          >
            <Edit2Icon className="h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyBookingLink}>
          <Link2Icon className="h-4 w-4" />
          Share booking link
        </DropdownMenuItem>
        <div className="border-t border-border my-1" />
        <DeleteLesson lessonId={lessonId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
