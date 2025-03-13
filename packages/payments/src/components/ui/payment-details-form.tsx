"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

interface PaymentDetailsFormProps {
  paymentMethod: string;
}

export function PaymentDetailsForm({ paymentMethod }: PaymentDetailsFormProps) {
  return (
    <div className="space-y-4">
      {paymentMethod === "card" && (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Cardholder Name</Label>
            <Input id="name" placeholder="John Doe" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="card-number">Card Number</Label>
            <Input
              id="card-number"
              placeholder="1234 5678 9012 3456"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input id="expiry" placeholder="MM/YY" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cvc">CVC</Label>
              <Input id="cvc" placeholder="123" required />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
