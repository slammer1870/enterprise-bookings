import { Plan } from "@repo/shared-types";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import { CircleCheck } from "lucide-react";

export const MembershipDetail = ({ membership }: { membership: Plan }) => {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground uppercase">
          {membership.name}
        </p>
        <CardTitle className="text-2xl font-medium">
          {membership.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {membership.features?.map((feature) => (
          <div key={feature?.id} className="flex items-center gap-2">
            <CircleCheck className="text-secondary w-4 h-4" />
            <p>{feature?.feature}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
