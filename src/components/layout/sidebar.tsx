'use client'

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { useLocation, Link } from 'react-router-dom'
import { Home, Settings, Package } from 'lucide-react'
import { Logo } from '../icons/logo'

export default function AppSidebar() {
  const { pathname } = useLocation()

  const menuItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      isActive: pathname.startsWith('/settings'),
    },
  ]

  return (
    <>
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Logo className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg">SellerFlow AI</span>
        </Link>
      </div>
      <div className="flex-1">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={item.isActive}
                tooltip={{
                  children: item.label,
                  className: 'font-heading',
                }}
              >
                <Link to={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </>
  )
}
