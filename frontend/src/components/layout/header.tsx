'use client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { ThemeToggle } from '../theme-toggle'
import { useLocation } from 'react-router-dom'
import { SidebarTrigger } from '../ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'

const getTitleFromPathname = (pathname: string) => {
  if (pathname === '/') return 'Dashboard'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'SellerFlow AI'
}

export default function Header() {
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const title = getTitleFromPathname(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {isMobile && <SidebarTrigger />}
      <h1 className="font-heading text-xl font-semibold md:text-2xl">
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  data-ai-hint="person avatar"
                  src="https://picsum.photos/seed/1/100/100"
                  alt="User avatar"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
