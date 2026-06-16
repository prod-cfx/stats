'use client'

import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'
import { createSearchParamReader } from '@/lib/search-params'
import { ProfileClient } from './ProfileClient'

export function WhaleProfileClientPage() {
  // React Doctor: page.tsx already wraps this client component in Suspense.
  // react-doctor-disable-next-line react-doctor/nextjs-no-use-search-params-without-suspense
  const searchParams = useSearchParams()
  const { get } = useMemo(() => createSearchParamReader(searchParams), [searchParams])
  const address = get('address') || '0xb31754025d57d727218ef86b97828135899983ae'
  return <ProfileClient address={address} />
}
