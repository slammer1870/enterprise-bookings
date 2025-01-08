import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar'
import { Button } from '@repo/ui/components/ui/button'
import { Card } from '@repo/ui/components/ui/card'

import { getPayload } from 'payload'

import config from '@payload-config'

export default async function Page() {
  const payload = await getPayload({
    config: config,
  })

  const lessons = await payload.find({
    collection: 'lessons',
    limit: 10,
    depth: 3,
  })

  console.log(lessons)

  return (
    <Card>
      <Button className="bg-red-500">Hello World</Button>
      <Avatar className="bg-green-500">
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    </Card>
  )
}
