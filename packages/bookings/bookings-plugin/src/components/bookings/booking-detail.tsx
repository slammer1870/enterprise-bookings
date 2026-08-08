"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Booking } from "@repo/shared-types";
import {
  bookingUserLabel,
  relationUserId,
} from "../../utils/booking-user-label";

export const BookingDetail = ({ booking }: { booking: Booking }) => {
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const userId = relationUserId(booking.user);
  const label = bookingUserLabel(booking.user);
  const userEditUrl =
    activeUserId != null ? `/admin/collections/users/${activeUserId}` : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeUserId == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveUserId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeUserId]);

  return (
    <>
      <div
        className={`${booking.status == "cancelled" && "text-gray-600 dark:text-gray-400 line-through"}`}
      >
        {userId != null ? (
          <button
            type="button"
            onClick={() => {
              setIframeLoaded(false);
              setActiveUserId(userId);
            }}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              color: "inherit",
              font: "inherit",
              // Child text-decoration overrides the parent line-through class
              textDecoration:
                booking.status === "cancelled"
                  ? "underline line-through"
                  : "underline",
            }}
          >
            {label}
          </button>
        ) : (
          label
        )}
        <span className="ml-2 text-red-500 dark:text-red-400">
          {booking.status == "pending" && "(Requires Payment)"}
          {booking.status == "waiting" && "(Waiting List)"}
        </span>
      </div>

      {mounted && activeUserId != null && userEditUrl != null
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "1rem",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Customer details"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setActiveUserId(null);
              }}
            >
              <div
                style={{
                  width: "min(1100px, 100%)",
                  height: "min(85vh, 900px)",
                  background: "var(--theme-elevation-0)",
                  border: "1px solid var(--theme-elevation-200, #eee)",
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid var(--theme-elevation-200, #eee)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Customer</div>
                  <button
                    type="button"
                    onClick={() => setActiveUserId(null)}
                    style={{
                      border: "1px solid var(--theme-elevation-300, #ddd)",
                      background: "transparent",
                      borderRadius: 6,
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  {!iframeLoaded && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.75rem",
                        background: "var(--theme-elevation-0, #fff)",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "3px solid var(--theme-elevation-200, #e0e0e0)",
                          borderTopColor: "var(--theme-text, #333)",
                          animation: "spin 0.75s linear infinite",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--theme-elevation-600, #666)",
                        }}
                      >
                        Loading customer…
                      </span>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  <iframe
                    src={userEditUrl}
                    title={`Customer ${activeUserId}`}
                    onLoad={() => setIframeLoaded(true)}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      background: "white",
                      display: "block",
                    }}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
