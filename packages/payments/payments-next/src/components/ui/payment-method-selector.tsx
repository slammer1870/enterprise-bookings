"use client";

import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { Label } from "@repo/ui/components/ui/label";

interface PaymentMethodSelectorProps {
  value: string;
  methods: string[];
  onChange: (value: string) => void;
}

export function PaymentMethodSelector({
  value,
  onChange,
  methods,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Payment Method</h3>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-[1fr_1fr] gap-4"
      >
        {methods.includes("card") && (
          <div>
            <RadioGroupItem value="card" id="card" className="peer sr-only" />
            <Label
              htmlFor="card"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-3 h-6 w-6"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              Card
            </Label>
          </div>
        )}
        {methods.includes("cash") && (
          <div>
            <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
            <Label
              htmlFor="cash"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-3 h-6 w-6"
              >
                <rect width="20" height="12" x="2" y="6" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
              Cash
            </Label>
          </div>
        )}
      </RadioGroup>
    </div>
  );
}

