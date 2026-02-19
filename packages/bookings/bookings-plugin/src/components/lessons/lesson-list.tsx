"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Lesson } from "@repo/shared-types";
import { LessonDetail } from "./lesson-detail";
import { Button, toast, ConfirmationModal, useModal } from "@payloadcms/ui";

export const LessonList: React.FC<{ lessons: Lesson[] }> = ({ lessons }) => {
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelection = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === (lessons?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((lessons ?? []).map((l) => l.id)));
    }
  }, [lessons, selectedIds.size]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    openModal("lessons-bulk-delete");
  }, [selectedIds, openModal]);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkDeleting(true);
    try {
      const response = await fetch("/api/lessons", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ where: { id: { in: ids } } }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.errors?.[0]?.message ?? "Failed to delete lessons");
        return;
      }

      toast.success(`${ids.length} lesson(s) deleted`);
      setSelectedIds(new Set());
      closeModal("lessons-bulk-delete");
      router.refresh();
    } catch {
      toast.error("Failed to delete lessons");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, closeModal, router]);

  const allSelected =
    (lessons?.length ?? 0) > 0 && selectedIds.size === (lessons?.length ?? 0);
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
                disabled={(lessons?.length ?? 0) === 0}
              />
            </th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Class Name</th>
            <th>Bookings</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lessons && lessons.length > 0 ? (
            lessons.map((lesson: Lesson) => (
              <LessonDetail
                key={lesson.id}
                lesson={lesson}
                isSelected={selectedIds.has(lesson.id)}
                onToggleSelection={(checked: boolean) => toggleSelection(lesson.id, checked)}
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
        modalSlug="lessons-bulk-delete"
        heading="Delete selected lessons?"
        body="This will delete the selected lessons and all their bookings. This cannot be undone."
        onConfirm={confirmBulkDelete}
        onCancel={() => closeModal("lessons-bulk-delete")}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </>
  );
};
