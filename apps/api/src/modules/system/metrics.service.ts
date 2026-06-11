import { Injectable } from '@nestjs/common'

export interface WorkerMetrics {
  lastScanAt: string | null
  lastScanDurationMs: number | null
  lastScanSatellites: number | null
  lastScanCandidatePairs: number | null
  lastScanReductionPercent: number | null
  lastScanConjunctionsFound: number | null
  lastAlertsGenerated: number | null
}

@Injectable()
export class MetricsService {
  private _worker: WorkerMetrics = {
    lastScanAt: null,
    lastScanDurationMs: null,
    lastScanSatellites: null,
    lastScanCandidatePairs: null,
    lastScanReductionPercent: null,
    lastScanConjunctionsFound: null,
    lastAlertsGenerated: null,
  }

  recordScan(metrics: Omit<WorkerMetrics, 'lastAlertsGenerated'>): void {
    this._worker = { ...this._worker, ...metrics }
  }

  recordAlertGeneration(count: number): void {
    this._worker.lastAlertsGenerated = count
  }

  get worker(): WorkerMetrics {
    return { ...this._worker }
  }
}
