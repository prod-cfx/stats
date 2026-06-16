import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'CoinFlux',
  description: 'CoinFlux market intelligence entry route.',
}

function getPreferredLng(): 'en' {
  return 'en'
}

export default function RootPage() {
  const preferredLng = getPreferredLng()
  redirect(`/${preferredLng}`)
}
