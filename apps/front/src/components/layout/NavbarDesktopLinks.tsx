'use client'

import type { NavbarLink } from './navbar.nav-data'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface NavbarDesktopLinksProps {
  links: NavbarLink[]
  pathname: string | null
  aiQuantHref: string
  homeHref: string
}

export function NavbarDesktopLinks({ links, pathname, aiQuantHref, homeHref }: NavbarDesktopLinksProps) {
  return (
    <div className="hidden h-full items-center gap-6 md:flex">
      {links.map(link => {
        const isActive =
          pathname === link.href ||
          (link.href === aiQuantHref && pathname === homeHref) ||
          (link.children && link.children.some(child => pathname === child.href))

        if (link.children) {
          return (
            <div key={link.name} className="group relative flex h-full items-center">
              <Link
                href={link.href}
                className={`relative flex h-full cursor-pointer items-center gap-1 !text-[13px] !font-semibold !leading-5 no-underline transition-colors ${
                  isActive
                    ? 'text-[color:var(--cf-text-strong)]'
                    : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                }`}
              >
                {link.name}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                {isActive && (
                  <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r" />
                )}
              </Link>

              <div className="invisible absolute top-[95%] left-0 z-50 w-40 translate-y-1.5 transform overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] opacity-0 shadow-sm transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="py-1.5">
                  {link.children.map(child => (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={`mx-1.5 block rounded-md px-3 py-2 !text-xs !font-semibold !leading-5 transition-colors ${
                        pathname === child.href
                          ? 'from-primary to-secondary bg-gradient-to-r !text-white'
                          : 'text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )
        }

        return (
          <Link
            key={link.name}
            href={link.href}
            className={`relative flex h-full items-center !text-[13px] !font-semibold !leading-5 transition-colors ${
              isActive
                ? 'text-[color:var(--cf-text-strong)]'
                : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
            }`}
          >
            {link.name}
            {isActive && (
              <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
