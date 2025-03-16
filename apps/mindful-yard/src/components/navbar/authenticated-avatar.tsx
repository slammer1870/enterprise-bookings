import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu'

import Link from 'next/link'

import { User } from '@repo/shared-types'

import { LogoutButton } from './logout-button'

import { User as UserIcon } from 'lucide-react'

export default function AuthenticaedAvatar({ user }: { user: User }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          <AvatarImage src={user.image?.url} alt="User Avatar" className="cursor-pointer" />
          <AvatarFallback>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 cursor-pointer">
              <UserIcon className="w-4 h-4" />
            </div>
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <LogoutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
