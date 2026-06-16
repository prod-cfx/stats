import type { BeforeApplicationShutdown } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

@Injectable()
export class ShutdownStateService implements BeforeApplicationShutdown {
  private shuttingDown = false

  beforeApplicationShutdown(): void {
    this.shuttingDown = true
  }

  isShuttingDown(): boolean {
    return this.shuttingDown
  }
}
