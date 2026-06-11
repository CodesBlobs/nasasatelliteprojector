export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum AlertSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Alert {
  id: string
  conjunctionId: string
  severity: AlertSeverity
  title: string
  description: string
  status: AlertStatus
  createdAt: Date
  updatedAt: Date
  acknowledgedAt: Date | null
  resolvedAt: Date | null
}
