import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar'
import { Button } from '@repo/ui/components/ui/button'
import { Card } from '@repo/ui/components/ui/card'

export default async function Page() {
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
