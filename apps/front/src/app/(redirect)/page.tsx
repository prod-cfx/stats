import { cookies } from 'next/headers'
import { RootRedirectClient } from './RootRedirectClient'

async function getPreferredLng() {
  const cookieStore = await cookies()

  const cookieLng = cookieStore.get('i18next')?.value?.toLowerCase()
  if (cookieLng?.startsWith('en')) return 'en'
  if (cookieLng?.startsWith('zh')) return 'zh'

  return 'en'
}

export default async function RootPage() {
  const preferredLng = await getPreferredLng()
  return <RootRedirectClient preferredLng={preferredLng} />
}
