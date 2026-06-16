'use client'

import type { NavbarLink, NavbarTranslate } from './navbar.nav-data'
import { ChevronDown, ChevronRight, FileText, Github, LogIn, Send, X } from 'lucide-react'
import Link from 'next/link'
import { CoinfluxMark } from '@/components/ui/CoinfluxMark'

interface NavbarMobileMenuProps {
  links: NavbarLink[]
  expandedMenus: string[]
  showLoginEntry: boolean
  year: number
  t: NavbarTranslate
  withLng: (path: string) => string
  onClose: () => void
  onToggleSubmenu: (name: string) => void
  onOpenLogin: () => void
  onFooterSocialClick: () => void
}

export function NavbarMobileMenu({
  links,
  expandedMenus,
  showLoginEntry,
  year,
  t,
  withLng,
  onClose,
  onToggleSubmenu,
  onOpenLogin,
  onFooterSocialClick,
}: NavbarMobileMenuProps) {
  return (
    <div className="animate-in slide-in-from-top-10 fixed inset-0 z-[60] flex flex-col bg-[color:var(--cf-bg)] duration-200 md:hidden">
      <div className="flex h-16 items-center justify-between border-b border-[color:var(--cf-border)] px-4">
        <div className="flex items-center">
          <CoinfluxMark className="size-7" />
          <span className="-ml-1.5 text-xl leading-none font-bold tracking-tight text-[color:var(--cf-text-strong)]">
            oinflux
          </span>
        </div>
        <button
          type="button"
          aria-label={t('nav.closeMenu', { defaultValue: 'Close menu' })}
          onClick={onClose}
          className="p-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
        >
          <X className="size-6" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {links.map((link, index) => {
          const hasChildren = link.children && link.children.length > 0
          const isExpanded = expandedMenus.includes(link.name)
          const submenuId = `mobile-nav-submenu-${index}`

          if (hasChildren) {
            return (
              <div key={link.name} className="flex flex-col">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  onClick={() => onToggleSubmenu(link.name)}
                  className="flex items-center justify-between px-2 py-3 text-lg font-medium text-[color:var(--cf-text-strong)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {link.name}
                  <ChevronDown
                    className={`size-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div
                    id={submenuId}
                    role="region"
                    aria-label={link.name}
                    className="mb-2 flex flex-col overflow-hidden rounded-lg bg-[color:var(--cf-surface)]/80 ring-1 ring-inset ring-[color:var(--cf-border)]/60"
                  >
                    {link.children!.map((child, childIndex) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        onClick={onClose}
                        className={`px-4 py-3 text-base text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] ${
                          childIndex > 0 ? 'border-t border-[color:var(--cf-border)]/70' : ''
                        }`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={onClose}
              className="flex items-center justify-between px-2 py-3 text-lg font-medium text-[color:var(--cf-text-strong)]"
            >
              <span>{link.name}</span>
              <ChevronRight className="size-5 text-[color:var(--cf-muted)]" />
            </Link>
          )
        })}

        {showLoginEntry && (
          <button
            type="button"
            onClick={onOpenLogin}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-3 text-base font-semibold !text-white shadow-sm transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LogIn className="size-4 !text-white" aria-hidden="true" />
            {t('nav.login')}
          </button>
        )}

        <div className="mt-auto border-t border-[color:var(--cf-border)]/70 pt-6">
          <div className="flex flex-col items-center gap-3">
            <Link href={withLng('/')} onClick={onClose} className="flex items-center no-underline">
              <CoinfluxMark className="size-7" />
              <span className="-ml-1.5 text-xl leading-none font-bold tracking-tight text-[color:var(--cf-text-strong)]">
                oinflux
              </span>
            </Link>
            <p className="text-center text-sm text-[color:var(--cf-muted)]">
              {t('footer.tagline', { defaultValue: '专业的加密资产 数据聚合与多维行情分析终端' })}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={onFooterSocialClick}
                className="flex size-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                aria-label="Telegram"
              >
                <Send className="size-5" />
              </button>
              <button
                type="button"
                onClick={onFooterSocialClick}
                className="flex size-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                aria-label="X"
              >
                <X className="size-5" />
              </button>
              <button
                type="button"
                onClick={onFooterSocialClick}
                className="flex size-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                aria-label="GitHub"
              >
                <Github className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onFooterSocialClick()
                  onClose()
                }}
                className="flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[color:var(--cf-muted)] no-underline transition-colors hover:text-[color:var(--cf-text-strong)]"
              >
                <FileText className="size-4" />
                {t('nav.docs', { defaultValue: '文档' })}
              </button>
            </div>
          </div>
          <div className="mt-5 border-t border-[color:var(--cf-border)]/50 pt-5 text-center text-xs leading-6 text-[color:var(--cf-muted)]">
            <p>
              {t('footer.copyrightLine', { year })}
              <br />
              {t('footer.ownership')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
