import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { CashPayment } from '@repo/payments/src/components/cash-payment'

import { ClassOption, DropIn, Lesson, Plan } from '@repo/shared-types'

//import { PlanList } from './plans/PlanList'

const paymentBlocks = {
  cash: CashPayment,
}

export function PaymentTabs({
  paymentMethods,
}: {
  paymentMethods: Lesson['classOption']['paymentMethods']
}) {
  if (!paymentMethods) {
    return null
  }

  return (
    <Tabs defaultValue="cash" className="w-full">
      <TabsList className="flex w-full justify-around gap-4">
        {paymentMethods.map((method) => (
          <TabsTrigger key={method} value={method} className="w-full">
            {method}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="cash">Cash Payment</TabsContent>
    </Tabs>
  )
}
