import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { Lesson } from '@repo/shared-types'
import { DropInPayment } from './drop-ins'

export function PaymentTabs({
  paymentMethods,
}: {
  paymentMethods: Lesson['classOption']['paymentMethods']
}) {
  if (!paymentMethods) {
    return null
  }

  return (
    <Tabs defaultValue="drop-in" className="w-full">
      <TabsList className="flex w-full justify-around gap-4">
        <TabsTrigger className="w-full" value="drop-in">
          Drop In
        </TabsTrigger>
      </TabsList>
      <TabsContent value="drop-in">
        <DropInPayment />
      </TabsContent>
    </Tabs>
  )
}
