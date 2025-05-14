import { Attendee } from "@repo/shared-types/src/bookings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import { Separator } from "@repo/ui/components/ui/separator";

import { CircleChevronLeft, CircleChevronRight } from "lucide-react";

interface PriceFormProps {
  price: number;
  attendeesCount: number;
  discountApplied: boolean;
  totalAmount: number;
  totalAmountBeforeDiscount: number;
  remainingCapacity: number;
  attendees: Attendee[];
  setAttendees: (attendees: Attendee[]) => void;
  adjustableQuantity: boolean;
}
export const PriceForm = ({
  price,
  attendeesCount,
  discountApplied,
  totalAmount,
  totalAmountBeforeDiscount,
  remainingCapacity,
  attendees,
  setAttendees,
  adjustableQuantity,
}: PriceFormProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Details:</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="my-2">
          <div className="flex justify-between items-center">
            <span>Price per person</span>
            <span>€{price?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Number of guests</span>
            {adjustableQuantity ? (
              <div className="flex items-center gap-2">
                {attendeesCount > 1 ? (
                  <CircleChevronLeft
                    className="w-4 h-4 cursor-pointer"
                    onClick={() =>
                      setAttendees(attendees.slice(0, attendeesCount - 1))
                    }
                  />
                ) : (
                  <CircleChevronLeft className="w-4 h-4 opacity-10" />
                )}
                <span>{attendeesCount}</span>
                {attendeesCount < remainingCapacity ? (
                  <CircleChevronRight
                    className="w-4 h-4 cursor-pointer"
                    onClick={() =>
                      setAttendees([
                        ...attendees,
                        {
                          id: (attendeesCount + 1).toString(),
                          name: "",
                          email: "",
                        },
                      ])
                    }
                  />
                ) : (
                  <CircleChevronRight className="w-4 h-4 opacity-10" />
                )}
              </div>
            ) : (
              <span>{attendeesCount}</span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Total</span>
          <div className="flex items-center gap-2">
            {discountApplied && (
              <span className="line-through text-red-400">
                €{totalAmountBeforeDiscount.toFixed(2)}
              </span>
            )}
            <span>€{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
