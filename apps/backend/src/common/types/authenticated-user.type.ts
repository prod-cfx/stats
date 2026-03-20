export interface AuthenticatedUser {
  id: string
  email: string | null
  roles: string[]
  principalType: 'user' | 'admin'
  bridged?: boolean
}


