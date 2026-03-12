import { buildHealthPayload } from '@ai/shared'
import { Injectable } from '@nestjs/common'

@Injectable()
export class HealthService {
  getHealth() {
    return buildHealthPayload('backend')
  }
}
