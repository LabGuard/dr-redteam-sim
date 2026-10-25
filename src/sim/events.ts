// 엔진·실행기와 화면 사이의 유일한 계약. 화면은 이벤트만 보고 그린다.
// 지금은 브라우저 안 모의 실행기가 만들고, 이후 실제 컨테이너 실행기가 WebSocket으로 같은 이벤트를 보낸다.

export type RoomState = 'normal' | 'fire' | 'no_access' | 'power_cut'
export type RackState = 'on' | 'off' | 'bypass'
export type ServiceState = 'up' | 'down' | 'standby' | 'starting' | 'degraded'
export type StepState = 'pending' | 'running' | 'ok' | 'fail' | 'skipped'
export type LogLevel = 'cmd' | 'info' | 'warn' | 'error' | 'ok' | 'dim'
export type Shot = 'overview' | 'battery' | 'mainRoom' | 'logical' | 'drSite' | 'edge' | 'recovered'

export type SimEvent =
  | { t: number; type: 'log'; level: LogLevel; text: string }
  | { t: number; type: 'room'; room: string; state: RoomState }
  | { t: number; type: 'fire'; room: string; intensity: number }
  | { t: number; type: 'temp'; room: string; value: number }
  | { t: number; type: 'infra'; id: string; on: boolean }
  | { t: number; type: 'rack'; id: string; state: RackState }
  | { t: number; type: 'service'; id: string; state: ServiceState; reason?: string }
  | { t: number; type: 'policy'; text: string }
  | { t: number; type: 'step'; no: number; state: StepState; measuredSec?: number; note?: string }
  | { t: number; type: 'edge_found'; from: string; to: string; via?: string }
  | { t: number; type: 'prediction'; result: 'pass' | 'fail' | 'blocked'; minutes: number | null; note: string }
  | { t: number; type: 'rpo'; writes: number; lost: number }
  | { t: number; type: 'banner'; tone: 'danger' | 'warn' | 'ok' | 'info'; title: string; sub?: string; hold?: number }
  | { t: number; type: 'camera'; shot: Shot }
  | { t: number; type: 'end'; result: 'pass' | 'fail' | 'incident' }

export type EventType = SimEvent['type']
