import { RootRedirectClient } from './RootRedirectClient'

function getPreferredLng(): 'en' {
  return 'en'
}

export default function RootPage() {
  const preferredLng = getPreferredLng()
  return <RootRedirectClient preferredLng={preferredLng} />
}
