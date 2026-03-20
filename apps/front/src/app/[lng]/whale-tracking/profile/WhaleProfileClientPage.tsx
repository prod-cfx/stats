'use client'

import { useSearchParams } from 'next/navigation'
import React from 'react'
import { ProfileClient } from './ProfileClient'

export function WhaleProfileClientPage() {
  const searchParams = useSearchParams()
  const address = searchParams?.get('address') || '0xb31754025d57d727218ef86b97828135899983ae'
  return <ProfileClient address={address} />
}
