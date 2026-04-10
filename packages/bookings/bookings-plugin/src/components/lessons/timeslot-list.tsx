"use client";

import React, { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Timeslot } from "@repo/shared-types";
import { TimeslotDetail } from "./timeslot-detail";
import { Button, toast, ConfirmationModal, useModal } from "@payloadcms/ui";

export const TimeslotList: React.FC<{ timeslots: Timeslot[] }> = ({ timeslots }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { openModal, closeModal } = useModal();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const collectionSlug =
    pathname?.split("/").filter(Boolean)[2] ?? "timeslots";

  const toggleSelection = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === (timeslots?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((timeslots ?? []).map((l) => l.id)));
    }
  }, [timeslots, selectedIds.size]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    openModal("timeslots-bulk-delete");
  }, [selectedIds, openModal]);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkDeleting(true);
    try {
      const response = await fetch(`/api/${collectionSlug}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ where: { id: { in: ids } } }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.errors?.[0]?.message ?? "Failed to delete timeslots");
        return;
      }

      toast.success(`${ids.length} timeslot(s) deleted`);
      setSelectedIds(new Set());
      closeModal("timeslots-bulk-delete");
      router.refresh();
    } catch {
      toast.error("Failed to delete timeslots");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, closeModal, router]);

  const allSelected =
    (timeslots?.length ?? 0) > 0 && selectedIds.size === (timeslots?.length ?? 0);
  const someSelected = selectedIds.size > 0;

  return (
    <>
      {someSelected && (
        <div className="flex items-center gap-2 p-2 border border-neutral-200 dark:border-neutral-700 rounded mb-2 bg-neutral-50 dark:bg-neutral-900">
          <span className="text-sm">
            {selectedIds.size} selected
          </span>
          <Button
            size="small"
            buttonStyle="secondary"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            Delete selected
          </Button>
          <Button
            size="small"
            buttonStyle="secondary"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      <table className="table w-full [&_thead_tr_th]:py-1.5">
        <thead>
          <tr>
            <th className="w-10">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={toggleSelectAll}
                disabled={(timeslots?.length ?? 0) === 0}
              />
            </th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Event Type</th>
            <th>Bookings</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {timeslots && timeslots.length > 0 ? (
            timeslots.map((timeslot: Timeslot) => (
              <TimeslotDetail
                key={timeslot.id}
                timeslot={timeslot}
                isSelected={selectedIds.has(timeslot.id)}
                onToggleSelection={(checked: boolean) => toggleSelection(timeslot.id, checked)}
              />
            ))
          ) : (
            <tr className="[&_td]:py-1.5">
              <td colSpan={6} className="text-center">
                No classes for today
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <ConfirmationModal
        modalSlug="timeslots-bulk-delete"
        heading="Delete selected timeslots?"
        body="This will delete the selected timeslots and all their bookings. This cannot be undone."
        onConfirm={confirmBulkDelete}
        onCancel={() => closeModal("timeslots-bulk-delete")}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </>
  );
};
