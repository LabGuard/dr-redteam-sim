import type { Topology } from './model'
import type { LogLevel, RackState, RoomState, ServiceState, Shot, SimEvent, StepState } from './events'

export interface Banner {
  key: string
  tone: 'danger' | 'warn' | 'ok' | 'info'
  title: string
  sub?: string
}

export interface WorldState {
  rooms: Record<string, RoomState>
  fire: Record<string, number>
  temp: Record<string, number>
  infra: Record<string, boolean>
  racks: Record<string, RackState>
  services: Record<string, { state: ServiceState; reason?: string }>
  steps: Record<number, { state: StepState; measuredSec?: number; note?: string }>
  edgesFound: { from: string; to: string; via?: string; at: number }[]
  prediction: { result: 'pass' | 'fail' | 'blocked'; minutes: number | null; note: string; at: number } | null
  rpo: { writes: number; lost: number }
  policy: string | null
  banner: Banner | null
  shot: Shot
  logs: { t: number; level: LogLevel; text: string }[]
  ended: boolean
}

export function initialWorld(topo: Topology): WorldState {
  return {
    rooms: Object.fromEntries(topo.rooms.map((r) => [r.id, 'normal' as RoomState])),
    fire: {},
    temp: { 'server-a': 23, 'dr-server': 22 },
    infra: Object.fromEntries(topo.infra.map((i) => [i.id, true])),
    racks: Object.fromEntries(topo.racks.map((r) => [r.id, 'on' as RackState])),
    services: Object.fromEntries(
      topo.services.map((s) => [s.id, { state: (s.role === 'primary' || s.hot ? 'up' : 'standby') as ServiceState }]),
    ),
    steps: {},
    edgesFound: [],
    prediction: null,
    rpo: { writes: 0, lost: 0 },
    policy: null,
    banner: null,
    shot: 'overview',
    logs: [],
    ended: false,
  }
}

// 이벤트를 시간 t까지 접어 화면 상태를 만든다. clone=false면 w를 그대로 고친다.
export function applyEvents(w: WorldState, events: SimEvent[], t: number, opts: { logs?: boolean } = {}) {
  let banner: { e: Extract<SimEvent, { type: 'banner' }> } | null = null
  for (const e of events) {
    if (e.t > t) break
    switch (e.type) {
      case 'room': w.rooms[e.room] = e.state; break
      case 'fire': w.fire[e.room] = e.intensity; break
      case 'temp': w.temp[e.room] = e.value; break
      case 'infra': w.infra[e.id] = e.on; break
      case 'rack': w.racks[e.id] = e.state; break
      case 'service': w.services[e.id] = { state: e.state, reason: e.reason }; break
      case 'step': w.steps[e.no] = { state: e.state, measuredSec: e.measuredSec, note: e.note }; break
      case 'edge_found': w.edgesFound.push({ from: e.from, to: e.to, via: e.via, at: e.t }); break
      case 'prediction': w.prediction = { result: e.result, minutes: e.minutes, note: e.note, at: e.t }; break
      case 'rpo': w.rpo = { writes: e.writes, lost: e.lost }; break
      case 'policy': w.policy = e.text; break
      case 'camera': w.shot = e.shot; break
      case 'banner': banner = { e }; break
      case 'log': if (opts.logs !== false) w.logs.push({ t: e.t, level: e.level, text: e.text }); break
      case 'end': w.ended = true; break
    }
  }
  if (banner && t < banner.e.t + (banner.e.hold ?? 4)) {
    w.banner = { key: `${banner.e.t}-${banner.e.title}`, tone: banner.e.tone, title: banner.e.title, sub: banner.e.sub }
  } else {
    w.banner = null
  }
  return w
}
