"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User } from "@repo/shared-types";
import { Button, SelectInput } from "@payloadcms/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button as UiButton } from "@repo/ui/components/ui/button";

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Waiting List", value: "waiting" },
  { label: "Cancelled", value: "cancelled" },
] as { label: string; value: string }[];

export const AddBooking = ({
  timeslotId,
  onBookingCreated,
}: {
  timeslotId: number;
  /** When set, avoids full admin `router.refresh()` after create (faster UI). */
  onBookingCreated?: () => void | Promise<void>;
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [lateMagicDialogOpen, setLateMagicDialogOpen] = useState(false);
  const [lateMagicSending, setLateMagicSending] = useState(false);
  const [lateMagicBookingId, setLateMagicBookingId] = useState<number | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/users?limit=0`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) {
          setUsers(data.docs ?? []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("Failed to load users");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const userOptions = [
    { label: "Select user", value: "" },
    ...(users.map((user) => ({
      label: `${user.name ?? user.email} – ${user.email}`,
      value: String(user.id),
    })) ?? []),
  ] as { label: string; value: string }[];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: Number(selectedUserId),
          timeslot: timeslotId,
          status,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.errors?.length) {
        toast.error(data.errors[0].message ?? "An error occurred");
        return;
      }

      toast.success("Booking added successfully");

      const extractBookingId = (raw: unknown): number | string | null => {
        if (!raw) return null;
        if (typeof raw === "number" || typeof raw === "string") return raw;
        if (typeof raw === "object") {
          const r = raw as { id?: unknown; docs?: unknown };
          if (typeof r.id === "number" || typeof r.id === "string") return r.id;
          if (Array.isArray(r.docs) && r.docs[0] && typeof r.docs[0] === "object") {
            const first = r.docs[0] as { id?: unknown };
            if (typeof first.id === "number" || typeof first.id === "string") return first.id;
          }
        }
        return null;
      };

      // Payload create response is typically `{ doc: { id } }` (v3) but some setups may return
      // `{ id }` or `{ docs: [ { id } ] }`. Support all shapes so follow-up UX works.
      const createdBookingId = extractBookingId(
        (data as any)?.id ?? (data as any)?.doc?.id ?? (data as any)?.docs?.[0]?.id ?? null,
      );
      const offerMagicLink = status === "pending" && createdBookingId != null;

      if (offerMagicLink) {
        // Always offer the completion email for pending bookings, regardless of timeslot end time.
        setLateMagicBookingId(createdBookingId);
        setLateMagicDialogOpen(true);
      }

      setSelectedUserId("");
      setStatus("pending");
      if (onBookingCreated) {
        await onBookingCreated();
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSendLateMagicLink = async () => {
    if (lateMagicBookingId == null) return
    setLateMagicSending(true)
    try {
      const res = await fetch(`/api/admin/bookings/late-magic-link/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: lateMagicBookingId }),
        credentials: "include",
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Failed with status ${res.status}`)
      }

      toast.success("Booking magic link sent")
      setLateMagicDialogOpen(false)
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to send booking magic link")
    } finally {
      setLateMagicSending(false)
    }
  }

  return (
    <div className="my-4 text-sm add-booking-form min-w-0 max-w-full">
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-4 text-sm min-w-0"
      >
        <div className="min-w-0 w-full flex-1 flex flex-col justify-end sm:min-w-[180px] sm:flex-initial sm:max-w-[220px]">
          <label className="text-xs mb-1 block font-medium text-foreground">
            User
          </label>
          <div className="add-booking-input-wrapper flex min-w-0 max-w-full flex-col gap-1 [&_.field-label]:!hidden [&_.input]:!min-h-7 [&_.input]:!py-0.5 [&_input]:!min-h-7 [&_[role=combobox]]:!min-h-7 [&_[role=combobox]]:!py-0.5 [&_[role=combobox]]:!max-w-full [&_.input]:!min-w-0">
            <SelectInput
              path="add-booking-user"
              name="add-booking-user"
              value={selectedUserId}
              onChange={(opt) => {
                const o = Array.isArray(opt) ? opt[0] : opt;
                setSelectedUserId(
                  o && typeof o === "object" && "value" in o
                    ? String(o.value)
                    : ""
                );
              }}
              options={userOptions}
              readOnly={isLoading}
            />
          </div>
        </div>
        <div className="min-w-0 w-full flex-1 flex flex-col justify-end sm:min-w-[120px] sm:flex-initial sm:max-w-[160px]">
          <label className="text-xs mb-1 block font-medium text-foreground">
            Status
          </label>
          <div className="add-booking-input-wrapper flex min-w-0 max-w-full flex-col gap-1 [&_.field-label]:!hidden [&_.input]:!min-h-7 [&_.input]:!py-0.5 [&_input]:!min-h-7 [&_[role=combobox]]:!min-h-7 [&_[role=combobox]]:!py-0.5 [&_[role=combobox]]:!max-w-full [&_.input]:!min-w-0">
            <SelectInput
              path="add-booking-status"
              name="add-booking-status"
              value={status}
              isClearable={false}
              onChange={(opt) => {
                const o = Array.isArray(opt) ? opt[0] : opt;
                setStatus(
                  o && typeof o === "object" && "value" in o
                    ? String(o.value)
                    : "pending"
                );
              }}
              options={statusOptions}
            />
          </div>
        </div>
        <div className="flex flex-col justify-end w-full sm:w-auto sm:ml-auto shrink-0">
          <Button
            type="submit"
            size="small"
            disabled={isLoading || submitting}
            className="shrink-0 my-0"
          >
            Add Booking
          </Button>
        </div>
      </form>

      <Dialog
        open={lateMagicDialogOpen}
        onOpenChange={(open) => {
          setLateMagicDialogOpen(open);
          if (!open) setLateMagicSending(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send completion magic link?</DialogTitle>
            <DialogDescription>
              Send the email now so the user can manage the booking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <UiButton
              type="button"
              variant="outline"
              disabled={lateMagicSending}
              onClick={() => setLateMagicDialogOpen(false)}
            >
              Deny
            </UiButton>
            <UiButton
              type="button"
              variant="secondary"
              disabled={lateMagicSending}
              onClick={() => void confirmSendLateMagicLink()}
            >
              {lateMagicSending ? "Sending..." : "Confirm & Send"}
            </UiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
