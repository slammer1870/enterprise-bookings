"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lesson } from "@repo/shared-types";
import {
  SelectionProvider,
  useConfig,
  SelectAll,
  ListSelection,
} from "@payloadcms/ui";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@repo/ui/components/ui/table";
import { LessonDetail } from "./lesson-detail";

const COLLECTION_SLUG = "lessons";
const BULK_BAR_PORTAL_ID = "lessons-bulk-bar-portal";

/**
 * Bulk actions bar when at least one row is selected. Portals into the header
 * row (right side, aligned with Create button) to match other Payload collections.
 */
function LessonsBulkBar() {
  const { getEntityConfig } = useConfig();
  const collectionConfig = getEntityConfig({ collectionSlug: COLLECTION_SLUG });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById(BULK_BAR_PORTAL_ID));
  }, []);

  if (!collectionConfig) return null;

  const label =
    typeof collectionConfig.labels?.plural === "string"
      ? collectionConfig.labels.plural
      : "Lessons";

  const content = (
    <ListSelection
      collectionConfig={collectionConfig}
      label={label}
    />
  );

  if (portalTarget) {
    return createPortal(content, portalTarget);
  }

  return (
    <div className="flex justify-end mb-2">
      {content}
    </div>
  );
}

/**
 * Table body rows: each row uses SelectRow (Payload's checkbox) and LessonDetail content.
 */
function LessonTableContent({ lessons }: { lessons: Lesson[] }) {
  if (!lessons?.length) {
    return (
      <TableRow className="[&_td]:py-1.5">
        <TableCell colSpan={6} className="text-center">
          No classes for today
        </TableCell>
      </TableRow>
    );
  }
  return (
    <>
      {lessons.map((lesson) => (
        <LessonDetail key={lesson.id} lesson={lesson} />
      ))}
    </>
  );
}

/**
 * Wraps the lessons list in Payload's SelectionProvider and renders the bulk bar (Edit + Delete)
 * and table with SelectAll and SelectRow so bulk behavior matches other collections.
 */
export const LessonsListWithSelection: React.FC<{
  lessons: Lesson[];
  /** Pass a key that changes when the list filter changes (e.g. date) so selection resets. */
  listKey?: string;
}> = ({ lessons, listKey }) => {
  const docs = React.useMemo(
    () =>
      (lessons ?? []).map((l) => ({
        id: String(l.id),
        _isLocked: false,
      })),
    [lessons]
  );
  const totalDocs = docs.length;

  return (
    <SelectionProvider docs={docs} totalDocs={totalDocs} key={listKey}>
      <LessonsBulkBar />
      <Table>
        <TableHeader>
          <TableRow className="[&_th]:py-1.5 [&_th]:h-auto">
            <TableHead className="w-10">
              <SelectAll />
            </TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Class Name</TableHead>
            <TableHead>Bookings</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <LessonTableContent lessons={lessons ?? []} />
        </TableBody>
      </Table>
    </SelectionProvider>
  );
};
