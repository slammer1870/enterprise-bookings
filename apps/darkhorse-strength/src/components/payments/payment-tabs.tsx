import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { Lesson } from '@repo/shared-types'

//import { MembershipView } from '@repo/memberships/src/components/ui/memebership-view'

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
        <TabsTrigger className="w-full" value="membership">
          Membership
        </TabsTrigger>
      </TabsList>
      <TabsContent value="membership">{/* <MembershipView /> */}</TabsContent>
    </Tabs>
  )
}
