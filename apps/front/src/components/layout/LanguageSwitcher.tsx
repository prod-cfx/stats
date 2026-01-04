'use client'

import { Check, Globe } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!mounted) return null

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
  ]

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code)
    // Persist language for server-rendered routes (RSC) via cookie
    document.cookie = `i18next=${code}; Path=/; Max-Age=31536000; SameSite=Lax`
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#30363d] text-[#c9d1d9] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3] focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-label="Switch Language"
      >
        <Globe className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-32 origin-top-right overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in duration-200">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex w-full items-center justify-between px-4 py-2 text-sm text-left ${
                  i18n.language === lang.code
                    ? 'bg-gradient-to-r from-primary/10 to-secondary/10 text-primary'
                    : 'text-[#c9d1d9] hover:bg-[#21262d] hover:text-white'
                }`}
              >
                <span>{lang.label}</span>
                {i18n.language === lang.code && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
