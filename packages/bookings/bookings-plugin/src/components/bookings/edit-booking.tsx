"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Booking } from "@repo/shared-types";
import { Button, SelectInput } from "@payloadcms/ui";
import { Label } from "@repo/ui/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
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
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Waiting List", value: "waiting" },
] as { label: string; value: string }[];

export function EditBooking({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated?: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<string>(booking.status);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.errors?.length) {
        toast.error(data.errors[0].message ?? "An error occurred");
        return;
      }

      toast.success("Booking updated successfully");
      setOpen(false);
      await onUpdated?.();
      router.refresh();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmSendLateMagicLink() {
    if (booking.status !== "pending") return;

    setSendingMagicLink(true);
    try {
      const res = await fetch(`/api/admin/bookings/late-magic-link/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed with status ${res.status}`);
      }

      toast.success("Booking email sent");
      setSendDialogOpen(false);
    } catch (err) {
      toast.error(
        (err as Error).message ?? "Failed to send booking email"
      );
    } finally {
      setSendingMagicLink(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Manage Booking
        </button>
      </SheetTrigger>
      <SheetContent className="z-[100]">
        <SheetHeader>
          <SheetTitle>Edit Booking</SheetTitle>
        </SheetHeader>
        <div className="p-0 pt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Make changes to your booking here. Click save when you are done.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Name</span>
              <p className="text-sm">
                {typeof booking.user === "object"
                  ? booking.user.email
                  : String(booking.user)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-booking-status" className="text-xs">Status</Label>
              <div className="[&_.field-label]:!hidden min-h-7 [&_.input]:!min-h-7 [&_.input]:!py-0.5 [&_[role=combobox]]:!min-h-7 [&_[role=combobox]]:!py-0.5">
                <SelectInput
                  path="edit-booking-status"
                  name="edit-booking-status"
                  value={status}
                  onChange={(opt) => {
                    const o = Array.isArray(opt) ? opt[0] : opt;
                    setStatus(
                      o && typeof o === "object" && "value" in o
                        ? String(o.value)
                        : status
                    );
                  }}
                  options={statusOptions}
                  isClearable={false}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              {booking?.transaction && (
                <Link
                  href={`/admin/collections/transactions/${booking.transaction.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View Transaction
                </Link>
              )}

              {booking.status === "pending" && (
                <>
                  <UiButton
                    type="button"
                    variant="secondary"
                    disabled={sendingMagicLink}
                    onClick={() => setSendDialogOpen(true)}
                  >
                    {sendingMagicLink
                      ? "Sending..."
                      : "Send completion email"}
                  </UiButton>

                  <Dialog
                    open={sendDialogOpen}
                    onOpenChange={(next) => {
                      setSendDialogOpen(next);
                      if (!next) setSendingMagicLink(false);
                    }}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send completion email?</DialogTitle>
                        <DialogDescription>
                          Send the email now so the user can manage the booking.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="pt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <UiButton
                          type="button"
                          variant="outline"
                          disabled={sendingMagicLink}
                          onClick={() => setSendDialogOpen(false)}
                        >
                          Deny
                        </UiButton>
                        <UiButton
                          type="button"
                          variant="secondary"
                          disabled={sendingMagicLink}
                          onClick={() => void confirmSendLateMagicLink()}
                        >
                          {sendingMagicLink ? "Sending..." : "Confirm & Send"}
                        </UiButton>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              <Button type="submit" size="small" disabled={submitting}>
                Save
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
