"use client";

import { ChevronUp, ChevronDown } from "lucide-react";

import { useState } from "react";

export const BookingsCount = ({ count }: { count: number }) => {
  const [openAccordion, setOpenAccordion] = useState(false);
  return (
    <div className="flex items-center justify-end">
      <span
        onClick={() => setOpenAccordion(!openAccordion)}
        className="flex items-center gap-2 outline outline-1 outline-zinc-600 p-2 text-xs rounded-md cursor-pointer"
      >
        <>
          <p>{count || 0}</p>
          {openAccordion ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </>
      </span>
    </div>
  );
};
