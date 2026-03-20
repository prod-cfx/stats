export interface JwtPayload {
  sub: string
  email?: string | null
  roles?: string[]
  principalType?: 'user' | 'admin'
  tokenVersion?: number // 用于密码重置后使旧 token 失效
  iat?: number
  exp?: number
}


