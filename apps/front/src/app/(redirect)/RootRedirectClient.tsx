'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RootRedirectClientProps {
  preferredLng: 'zh' | 'en'
}

export function RootRedirectClient({ preferredLng }: RootRedirectClientProps) {
  const router = useRouter()

  useEffect(() => {
    const search = window.location.search
    const hash = window.location.hash
    router.replace(`/${preferredLng}${search}${hash}`)
  }, [preferredLng, router])

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=/${preferredLng}/`} />
      </noscript>
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <div className="text-[#c9d1d9]">Loading...</div>
      </div>
    </>
  )
}
