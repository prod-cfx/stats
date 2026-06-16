import type { Socket } from 'socket.io'

import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class SocketAuthService {
  private readonly logger = new Logger(SocketAuthService.name)

  constructor(private readonly jwtService: JwtService) {}

  authenticate(client: Socket): void {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      this.logger.log({
        message: 'Guest client connected (no token)',
        clientId: client.id,
      })
      client.data.isGuest = true
      return
    }

    try {
      const payload = this.jwtService.verify(token)
      client.data.userId = payload.sub || payload.userId
      client.data.username = payload.username
      client.data.isGuest = false

      this.logger.log({
        message: 'Authenticated client connected',
        clientId: client.id,
        userId: client.data.userId,
      })
    } catch (error) {
      this.logger.warn({
        message: 'Invalid token, connecting as guest',
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
      })
      client.data.isGuest = true
    }
  }
}
