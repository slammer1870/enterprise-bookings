"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User } from "@repo/shared-types";
import { Button, SelectInput } from "@payloadcms/ui";

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
    </div>
  );
};
