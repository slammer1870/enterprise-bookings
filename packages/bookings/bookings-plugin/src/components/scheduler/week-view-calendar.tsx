"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Calendar,
  momentLocalizer,
  View,
  SlotInfo,
  Event as RBCEvent,
} from "react-big-calendar";
import moment from "moment";
import { startOfWeek, addDays, getDay } from "date-fns";
import type { GroupFieldClientProps } from "payload";
import { useField, useFormFields } from "@payloadcms/ui";
import {
  schedulerToCalendarEvents,
  calendarEventsToScheduler,
  createNewTimeSlotEvent,
  validateSlotConflict,
  getDayIndexFromDate,
  type CalendarEvent,
  type TimeSlotData,
  type WeekData,
  type DayData,
} from "../../lib/scheduler-calendar-utils";
import { EditTimeSlotDialog } from "./edit-time-slot-dialog";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./week-view-calendar.css";

const localizer = momentLocalizer(moment);

interface WeekViewCalendarProps extends GroupFieldClientProps {
  field: GroupFieldClientProps["field"] & {
    admin?: {
      description?: string;
    };
  };
}

export const WeekViewCalendar: React.FC<WeekViewCalendarProps> = ({
  path,
  field,
}) => {
  const { value, setValue } = useField<WeekData>({ path });
  
  // Also access the nested days field directly to ensure changes are properly tracked
  const daysPath = `${path}.days`;
  console.log("[WeekViewCalendar] daysPath:", daysPath);
  const { setValue: setDaysValue } = useField<any[]>({ path: daysPath });
  
  // Use useFormFields to get direct access to the form fields state for debugging
  const weekFieldInForm = useFormFields(([fields]) => fields[path]);

  // Track if we've initialized the week structure to prevent resetting user changes
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Ensure the week structure is fully initialized with all 7 days
  React.useEffect(() => {
    if (hasInitialized) {
      // Don't re-initialize if we've already done it once
      return;
    }

    if (!value || !value.days) {
      // Initialize with all 7 days if structure doesn't exist
      console.log(
        "[WeekViewCalendar] Initializing week structure with 7 empty days"
      );
      const initialDays = Array.from({ length: 7 }, () => ({ timeSlot: [] }));
      setValue({
        days: initialDays,
      });
      setDaysValue(initialDays); // Also update nested field directly
      setHasInitialized(true);
    } else if (value.days && value.days.length < 7) {
      // Ensure we have all 7 days, fill missing days with empty slots
      console.log(
        "[WeekViewCalendar] Expanding days array to 7 days (currently",
        value.days.length,
        "days)"
      );
      const days = [...value.days];
      while (days.length < 7) {
        days.push({ timeSlot: [] });
      }
      setValue({
        ...value,
        days,
      });
      setDaysValue(days); // Also update nested field directly
      setHasInitialized(true);
    } else if (value.days && value.days.length === 7) {
      // Structure is already complete, mark as initialized
      setHasInitialized(true);
    }
  }, [value, setValue, hasInitialized]);

  // Get default class option, lock out time, and start date from parent form
  const defaultClassOption = useFormFields(
    ([fields]) => fields.defaultClassOption?.value
  );
  const defaultLockOutTime = useFormFields(
    ([fields]) => fields.lockOutTime?.value ?? 0
  );
  const startDate = useFormFields(([fields]) => fields.startDate?.value);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState<Date | null>(null);
  const [newSlotEnd, setNewSlotEnd] = useState<Date | null>(null);

  // Calculate the preview week - first full week (Monday-Sunday) starting on or after start date
  const previewWeekStart = useMemo(() => {
    if (
      !startDate ||
      (typeof startDate === "object" && Object.keys(startDate).length === 0)
    ) {
      // If no start date is set, use a default week (current week)
      const today = new Date();
      return startOfWeek(today, { weekStartsOn: 1 });
    }

    let start: Date;
    if (startDate instanceof Date) {
      start = startDate;
    } else if (typeof startDate === "string" || typeof startDate === "number") {
      start = new Date(startDate);
    } else {
      // Fallback to current week if invalid
      const today = new Date();
      return startOfWeek(today, { weekStartsOn: 1 });
    }
    if (isNaN(start.getTime())) {
      // Invalid date, use current week
      const today = new Date();
      return startOfWeek(today, { weekStartsOn: 1 });
    }

    const weekStart = startOfWeek(start, { weekStartsOn: 1 }); // Get Monday of the week containing start date

    // If the start date is before or on the Monday of its week, use that week
    // Otherwise, use the next week (next Monday)
    if (start <= weekStart) {
      return weekStart;
    } else {
      // Move to the next Monday
      return addDays(weekStart, 7);
    }
  }, [startDate]);

  // Convert scheduler data to calendar events using preview week
  const events = useMemo(() => {
    if (!value || !value.days) {
      console.log(
        "[WeekViewCalendar] No value or days found in week data:",
        value
      );
      return [];
    }
    const calendarEvents = schedulerToCalendarEvents(
      value as WeekData,
      previewWeekStart
    );
    console.log(
      "[WeekViewCalendar] Calendar events from week data:",
      calendarEvents.length,
      "events"
    );
    return calendarEvents;
  }, [value, previewWeekStart]);

  // Debug: Log when value changes from form/payload
  React.useEffect(() => {
    if (value) {
      console.log(
        "[WeekViewCalendar] Week value received from Payload:",
        JSON.stringify(value, null, 2)
      );
      console.log("[WeekViewCalendar] Days count:", value.days?.length || 0);
      if (value.days && value.days.length > 0) {
        const totalSlots = value.days.reduce(
          (sum, day) => sum + (day.timeSlot?.length || 0),
          0
        );
        console.log("[WeekViewCalendar] Total time slots:", totalSlots);
      }
    }
  }, [value]);

  // Handle slot selection (clicking empty time slot)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    console.log("[WeekViewCalendar] handleSelectSlot called with:", slotInfo);
    const { start, end } = slotInfo;
    setNewSlotStart(start);
    setNewSlotEnd(end);
    setSelectedEvent(null);
    setIsDialogOpen(true);
    console.log("[WeekViewCalendar] Dialog should now be open");
  }, []);

  // Handle event selection (clicking existing event)
  const handleSelectEvent = useCallback((event: RBCEvent) => {
    console.log("[WeekViewCalendar] handleSelectEvent called with:", event);
    const calendarEvent = event as unknown as CalendarEvent;
    setSelectedEvent(calendarEvent);
    setNewSlotStart(null);
    setNewSlotEnd(null);
    setIsDialogOpen(true);
    console.log("[WeekViewCalendar] Dialog should now be open for editing");
  }, []);

  // Handle event drop (drag to move)
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
      const calendarEvent = event as unknown as CalendarEvent;
      const dayIndex = getDayIndexFromDate(start);

      // Get all events for validation
      const updatedEvents = events.map((e) => {
        if (e.id === calendarEvent.id) {
          return {
            ...e,
            start,
            end,
            resource: {
              ...e.resource,
              dayIndex,
              slotData: {
                ...e.resource.slotData,
                startTime: start,
                endTime: end,
              },
            },
          };
        }
        return e;
      });

      // Validate conflicts
      const updatedSlot = updatedEvents.find((e) => e.id === calendarEvent.id);
      if (updatedSlot) {
        const otherSlots = updatedEvents.filter(
          (e) => e.id !== calendarEvent.id
        );
        const daySlots = otherSlots.filter(
          (e) => e.resource.dayIndex === dayIndex
        );

        const conflict = validateSlotConflict(
          updatedSlot.resource.slotData,
          daySlots.map((e) => e.resource.slotData),
          calendarEvent.id
        );

        if (conflict) {
          alert(conflict);
          return;
        }
      }

      // Update scheduler data - preserve existing structure
      const newSchedulerData = calendarEventsToScheduler(updatedEvents, value);
      setValue(newSchedulerData);
    },
    [events, setValue, value]
  );

  // Handle event resize (drag edge to resize)
  const handleEventResize = useCallback(
    ({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
      const calendarEvent = event as unknown as CalendarEvent;

      // Validate end time is after start time
      if (end <= start) {
        alert("End time must be after start time");
        return;
      }

      // Get all events for validation
      const updatedEvents = events.map((e) => {
        if (e.id === calendarEvent.id) {
          return {
            ...e,
            start,
            end,
            resource: {
              ...e.resource,
              slotData: {
                ...e.resource.slotData,
                startTime: start,
                endTime: end,
              },
            },
          };
        }
        return e;
      });

      // Validate conflicts
      const updatedSlot = updatedEvents.find((e) => e.id === calendarEvent.id);
      if (updatedSlot) {
        const otherSlots = updatedEvents.filter(
          (e) => e.id !== calendarEvent.id
        );
        const daySlots = otherSlots.filter(
          (e) => e.resource.dayIndex === updatedSlot.resource.dayIndex
        );

        const conflict = validateSlotConflict(
          updatedSlot.resource.slotData,
          daySlots.map((e) => e.resource.slotData),
          calendarEvent.id
        );

        if (conflict) {
          alert(conflict);
          return;
        }
      }

      // Update scheduler data - preserve existing structure
      const newSchedulerData = calendarEventsToScheduler(updatedEvents, value);
      setValue(newSchedulerData);
    },
    [events, setValue, value]
  );

  // Handle saving time slot from dialog
  const handleSaveTimeSlot = useCallback(
    (slotData: TimeSlotData) => {
      console.log(
        "[WeekViewCalendar] handleSaveTimeSlot called with slotData:",
        slotData
      );
      console.log("[WeekViewCalendar] Current events count:", events.length);
      console.log("[WeekViewCalendar] selectedEvent:", selectedEvent);
      console.log("[WeekViewCalendar] newSlotStart:", newSlotStart);
      console.log("[WeekViewCalendar] newSlotEnd:", newSlotEnd);
      if (selectedEvent) {
        // Update existing event
        const updatedEvents = events.map((e) => {
          if (e.id === selectedEvent.id) {
            return {
              ...e,
              title: slotData.classOption
                ? typeof slotData.classOption === "object"
                  ? slotData.classOption.name || "Lesson"
                  : `Class ${slotData.classOption}`
                : "Lesson",
              resource: {
                ...e.resource,
                slotData: {
                  ...slotData,
                  startTime: slotData.startTime,
                  endTime: slotData.endTime,
                },
              },
            };
          }
          return e;
        });

        // Validate conflicts
        const updatedSlot = updatedEvents.find(
          (e) => e.id === selectedEvent.id
        );
        if (updatedSlot) {
          const otherSlots = updatedEvents.filter(
            (e) => e.id !== selectedEvent.id
          );
          const daySlots = otherSlots.filter(
            (e) => e.resource.dayIndex === updatedSlot.resource.dayIndex
          );

          const conflict = validateSlotConflict(
            updatedSlot.resource.slotData,
            daySlots.map((e) => e.resource.slotData),
            selectedEvent.id
          );

          if (conflict) {
            alert(conflict);
            return;
          }
        }

        const newSchedulerData = calendarEventsToScheduler(
          updatedEvents,
          value
        );
        console.log(
          "[WeekViewCalendar] Saving updated time slot - week data:",
          JSON.stringify(newSchedulerData, null, 2)
        );
        console.log(
          "[WeekViewCalendar] Current week field in form:",
          weekFieldInForm
        );

        // Ensure we preserve the existing structure and update all days
        // Convert Date objects to ISO strings for Payload compatibility
        const weekDataToSave = {
          days: newSchedulerData.days
            ? newSchedulerData.days.map((day) => ({
                ...day,
                timeSlot: day.timeSlot
                  ? day.timeSlot.map((slot) => ({
                      ...slot,
                      startTime:
                        slot.startTime instanceof Date
                          ? slot.startTime.toISOString()
                          : slot.startTime,
                      endTime:
                        slot.endTime instanceof Date
                          ? slot.endTime.toISOString()
                          : slot.endTime,
                    }))
                  : [],
              }))
            : [],
        };
        console.log(
          "[WeekViewCalendar] Calling setValue with:",
          JSON.stringify(weekDataToSave, null, 2)
        );
        setValue(weekDataToSave);
        if (weekDataToSave.days) {
          setDaysValue(weekDataToSave.days);
        }

        console.log(
          "[WeekViewCalendar] After setValue - week field in form:",
          weekFieldInForm
        );
      } else if (newSlotStart && newSlotEnd) {
        // Create new event
        const dayIndex = getDayIndexFromDate(newSlotStart);
        const newEvent = createNewTimeSlotEvent(
          newSlotStart,
          newSlotEnd,
          dayIndex
        );

        const updatedEvents = [
          ...events,
          {
            ...newEvent,
            resource: {
              ...newEvent.resource,
              slotData: {
                ...newEvent.resource.slotData,
                ...slotData,
              },
            },
          },
        ];

        // Validate conflicts
        const newSlot = updatedEvents.find((e) => e.id === newEvent.id);
        if (newSlot) {
          const otherSlots = updatedEvents.filter((e) => e.id !== newEvent.id);
          const daySlots = otherSlots.filter(
            (e) => e.resource.dayIndex === dayIndex
          );

          const conflict = validateSlotConflict(
            newSlot.resource.slotData,
            daySlots.map((e) => e.resource.slotData)
          );

          if (conflict) {
            alert(conflict);
            return;
          }
        }

        const newSchedulerData = calendarEventsToScheduler(
          updatedEvents,
          value
        );
        console.log(
          "[WeekViewCalendar] Saving new time slot - week data:",
          JSON.stringify(newSchedulerData, null, 2)
        );
        console.log(
          "[WeekViewCalendar] Current week field in form:",
          weekFieldInForm
        );

        // Update both the group field and the nested days array field to ensure Payload recognizes the change
        // Convert Date objects to ISO strings for Payload compatibility
        const weekDataToSave = {
          days: newSchedulerData.days
            ? newSchedulerData.days.map((day) => ({
                ...day,
                timeSlot: day.timeSlot
                  ? day.timeSlot.map((slot) => ({
                      ...slot,
                      startTime:
                        slot.startTime instanceof Date
                          ? slot.startTime.toISOString()
                          : slot.startTime,
                      endTime:
                        slot.endTime instanceof Date
                          ? slot.endTime.toISOString()
                          : slot.endTime,
                    }))
                  : [],
              }))
            : [],
        };
        console.log(
          "[WeekViewCalendar] Calling setValue with:",
          JSON.stringify(weekDataToSave, null, 2)
        );
        setValue(weekDataToSave);
        if (weekDataToSave.days) {
          setDaysValue(weekDataToSave.days);
        }

        console.log(
          "[WeekViewCalendar] After setValue - week field in form:",
          weekFieldInForm
        );
      }

      setIsDialogOpen(false);
      setSelectedEvent(null);
      setNewSlotStart(null);
      setNewSlotEnd(null);
    },
    [
      selectedEvent,
      events,
      newSlotStart,
      newSlotEnd,
      setValue,
      setDaysValue,
      value,
      weekFieldInForm,
    ]
  );

  // Handle deleting time slot
  const handleDeleteTimeSlot = useCallback(() => {
    if (selectedEvent) {
      const updatedEvents = events.filter((e) => e.id !== selectedEvent.id);
      const newSchedulerData = calendarEventsToScheduler(updatedEvents, value);
      console.log(
        "[WeekViewCalendar] Saving after delete:",
        JSON.stringify(newSchedulerData, null, 2)
      );
      // Ensure we preserve the existing structure and update all days
      setValue(newSchedulerData);
      if (newSchedulerData.days) {
        setDaysValue(newSchedulerData.days);
      }
    }
    setIsDialogOpen(false);
    setSelectedEvent(null);
  }, [selectedEvent, events, setValue, value]);

  // Custom event style
  const eventStyleGetter = (event: RBCEvent) => {
    return {
      style: {
        backgroundColor: "var(--theme-success-500)",
        borderColor: "var(--theme-success-600)",
        color: "white",
        borderRadius: "4px",
        border: "1px solid",
        padding: "2px 4px",
        fontSize: "0.875rem",
      },
    };
  };

  // Custom day prop getter for styling
  const dayPropGetter = (date: Date) => {
    return {
      style: {
        backgroundColor: "var(--theme-elevation-50)",
      },
    };
  };

  return (
    <div style={{ height: "600px", marginTop: "1rem", width: "100%" }}>
      <p
        style={{
          color: "var(--theme-elevation-400)",
          marginBottom: "0.75rem",
          fontSize: "0.875rem",
        }}
      >
        {field.admin?.description ||
          "Set up your weekly schedule template. Time slots set for each day will apply to all instances of that day between the start and end dates."}
      </p>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div className="static-template-view">
          <Calendar
            localizer={localizer}
            events={events as RBCEvent[]}
            defaultView="week"
            views={["week"]}
            view="week"
            date={previewWeekStart}
            onNavigate={() => {}} // Disable navigation - always show preview week
            onView={() => {}}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            step={15}
            timeslots={4}
            min={new Date(1970, 0, 1, 6, 0)}
            max={new Date(1970, 0, 1, 23, 0)}
            formats={{
              timeGutterFormat: "HH:mm",
              eventTimeRangeFormat: ({ start, end }) =>
                `${moment(start).format("HH:mm")} - ${moment(end).format("HH:mm")}`,
              dayHeaderFormat: (date: Date) => {
                // Show only day name
                return moment(date).format("dddd");
              },
              dayRangeHeaderFormat: ({
                start,
                end,
              }: {
                start?: Date;
                end?: Date;
              }) => {
                // Show the date range for the preview week
                if (start && end) {
                  return `Preview: ${moment(start).format("MMM D")} - ${moment(end).format("MMM D, YYYY")}`;
                }
                return "Weekly Schedule Preview";
              },
            }}
            style={
              {
                "--rbc-event-border": "var(--theme-success-600)",
              } as React.CSSProperties
            }
          />
        </div>
      </div>

      {isDialogOpen && (
        <>
          {console.log(
            "[WeekViewCalendar] Rendering EditTimeSlotDialog, isDialogOpen:",
            isDialogOpen
          )}
          <EditTimeSlotDialog
            isOpen={isDialogOpen}
            onClose={() => {
              setIsDialogOpen(false);
              setSelectedEvent(null);
              setNewSlotStart(null);
              setNewSlotEnd(null);
            }}
            onSave={handleSaveTimeSlot}
            onDelete={handleDeleteTimeSlot}
            initialSlot={
              selectedEvent
                ? selectedEvent.resource.slotData
                : newSlotStart && newSlotEnd
                  ? {
                      startTime: newSlotStart,
                      endTime: newSlotEnd,
                      lockOutTime:
                        typeof defaultLockOutTime === "number"
                          ? defaultLockOutTime
                          : 0,
                    }
                  : undefined
            }
            defaultClassOption={
              defaultClassOption
                ? typeof defaultClassOption === "object" &&
                  defaultClassOption !== null &&
                  "id" in defaultClassOption
                  ? (defaultClassOption as { id: number }).id
                  : typeof defaultClassOption === "number"
                    ? defaultClassOption
                    : undefined
                : undefined
            }
            defaultLockOutTime={
              typeof defaultLockOutTime === "number" ? defaultLockOutTime : 0
            }
          />
        </>
      )}
    </div>
  );
};
