export interface CredentialBoundEventPayload {
  userId: string
  credentialType: string
  timestamp: string
  sourceId: string
  eventName: 'user.credential.bound'
}


