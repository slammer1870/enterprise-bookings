"use client";

import { Trash2, Plus } from "lucide-react";
import { Attendee } from "@repo/shared-types";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/ui/card";

interface AttendeeFormProps {
  attendees: Attendee[];
  setAttendees: (attendees: Attendee[]) => void;
  remainingCapacity: number;
  adjustableQuantity: boolean;
  primaryUserDisabled?: boolean;
}

export function AttendeeForm({
  attendees,
  setAttendees,
  remainingCapacity,
  adjustableQuantity,
  primaryUserDisabled = true,
}: AttendeeFormProps) {
  // Check for duplicate emails
  const isDuplicateEmail = (email: string, currentId: string): boolean => {
    if (!email) return false; // Empty emails don't count as duplicates
    return attendees.some(
      (attendee) =>
        attendee.id !== currentId &&
        attendee.email.toLowerCase() === email.toLowerCase()
    );
  };

  const updateAttendee = (
    id: string,
    field: keyof Omit<Attendee, "id">,
    value: string
  ) => {
    // Normalize email to lowercase
    const normalizedValue = field === "email" ? value.toLowerCase() : value;
    setAttendees(
      attendees.map((attendee) =>
        attendee.id === id ? { ...attendee, [field]: normalizedValue } : attendee
      )
    );
  };

  const addAttendee = () => {
    // Check against remaining capacity
    if (adjustableQuantity && attendees.length < remainingCapacity) {
      setAttendees([
        ...attendees,
        {
          id: `attendee-${Date.now()}-${attendees.length}`,
          name: "",
          email: "",
        },
      ]);
    }
  };

  const removeAttendee = (id: string) => {
    // Always keep at least one attendee
    if (attendees.length > 1) {
      setAttendees(attendees.filter((attendee) => attendee.id !== id));
    }
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Attendees</CardTitle>
        <CardDescription>
          Add information for each person attending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {attendees.map((attendee, index) => (
          <div key={attendee.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {index === 0 ? "Primary Guest" : `Guest ${index + 1}`}
              </h3>
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttendee(attendee.id)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`name-${attendee.id}`}>Full Name</Label>
                <Input
                  id={`name-${attendee.id}`}
                  value={attendee.name}
                  onChange={(e) =>
                    updateAttendee(attendee.id, "name", e.target.value)
                  }
                  placeholder="John Doe"
                  disabled={index === 0 && primaryUserDisabled}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`email-${attendee.id}`}>
                  Email (for booking confirmation)
                </Label>
                <div>
                  <Input
                    id={`email-${attendee.id}`}
                    type="email"
                    value={attendee.email}
                    onChange={(e) =>
                      updateAttendee(attendee.id, "email", e.target.value)
                    }
                    placeholder="john@example.com"
                    disabled={index === 0 && primaryUserDisabled}
                    required
                    className={
                      isDuplicateEmail(attendee.email, attendee.id)
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {isDuplicateEmail(attendee.email, attendee.id) && (
                    <p className="text-xs text-red-500 mt-1">
                      This email is already used by another attendee
                    </p>
                  )}
                </div>
              </div>
            </div>

            {index < attendees.length - 1 && <Separator />}
          </div>
        ))}

        {adjustableQuantity && attendees.length < remainingCapacity && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAttendee}
              disabled={attendees.length >= remainingCapacity}
              className="flex items-center"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Guest
            </Button>
          </div>
        )}

        {attendees.length >= remainingCapacity && (
          <p className="text-sm text-muted-foreground text-center">
            Maximum capacity reached ({remainingCapacity} available spots)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
