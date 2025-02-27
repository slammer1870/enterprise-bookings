import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";

//import CheckoutPage from './CheckoutPage'

import { ClassOption, DropIn, Lesson, Plan } from "@repo/shared-types";

//import { PlanList } from './plans/PlanList'

export function PaymentTabs({
  paymentMethods,
}: {
  paymentMethods: Lesson["classOption"]["paymentMethods"];
}) {
  return (
    <Tabs defaultValue="cash" className="w-full">
      <TabsList className="flex w-full justify-around gap-4">
        <TabsTrigger value="cash" className="w-full">
          Cash Payment
        </TabsTrigger>
      </TabsList>
      <TabsContent value="cash">Cash Payment</TabsContent>
    </Tabs>
  );
}
