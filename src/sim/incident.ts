import type { Topology } from './model'
import type { RackState, ServiceState, SimEvent } from './events'
import { resolveAvailability } from './graph'

export type ScenarioId = 'fire' | 'ups'

export const SCENARIOS: { id: ScenarioId; name: string; desc: string }[] = [
  { id: 'fire', name: '배터리실 화재', desc: '배터리 이설 작업 중 통전 상태 해체 → 불꽃 (2025.9.26 국정자원 화재 유형)' },
  { id: 'ups', name: 'UPS 고장', desc: 'UPS-A 인버터 고장 · 바이패스 실패로 서버실 전원 상실' },
]

export interface IncidentParams {
  shutdownAtC: number // 선제 셧다운 정책 임계 온도
}

export interface IncidentResult {
  events: SimEvent[]
  duration: number
  racks: Record<string, RackState>
  own: Record<string, ServiceState>
}

const ROOM_T0 = 23
const HEAT_CAPACITY = 1100 // kJ/°C, 서버실 공기·구조물 등가 열용량
const PASSIVE_LOSS = 0.9 // kW/°C, 벽체 등으로 빠져나가는 열
const DT = 5

// 방 단위 상태 기계 + 전원 그래프 + 냉각 열수지(C·dT/dt = P − Q)로 사고 이벤트를 만든다.
export function simulateIncident(topo: Topology, scenario: ScenarioId, params: IncidentParams): IncidentResult {
  const ev: SimEvent[] = []
  const push = (e: SimEvent) => ev.push(e)
  const log = (t: number, level: Extract<SimEvent, { type: 'log' }>['level'], text: string) => push({ t, type: 'log', level, text })

  const racks: Record<string, RackState> = Object.fromEntries(topo.racks.map((r) => [r.id, 'on' as RackState]))
  const infraOn: Record<string, boolean> = Object.fromEntries(topo.infra.map((i) => [i.id, true]))
  const own: Record<string, ServiceState> = Object.fromEntries(
    topo.services.map((s) => [s.id, (s.role === 'primary' || s.hot ? 'up' : 'standby') as ServiceState]),
  )
  let resolved = resolveAvailability(topo, own)

  const syncServices = (t: number) => {
    const next = resolveAvailability(topo, own)
    for (const s of topo.services) {
      const a = resolved[s.id]
      const b = next[s.id]
      if (a.state !== b.state) {
        push({ t, type: 'service', id: s.id, state: b.state, reason: b.reason })
        if (b.state === 'down') log(t, 'error', `${s.name} (${s.grade}) 중단${b.reason ? ` — ${b.reason}` : ''}`)
      }
    }
    resolved = next
  }

  const setRack = (t: number, id: string, state: RackState) => {
    racks[id] = state
    push({ t, type: 'rack', id, state })
    if (state === 'off') for (const s of topo.services) if (s.rack === id) own[s.id] = 'down'
    syncServices(t)
  }

  const mainRacks = topo.racks.filter((r) => r.room === 'server-a')
  // 셧다운 순서: 하위 등급 서비스가 있는 랙부터
  const gradeOf = (rackId: string) =>
    Math.min(...topo.services.filter((s) => s.rack === rackId).map((s) => Number(s.grade[1])), 9)
  const shutdownOrder = [...mainRacks].sort((a, b) => gradeOf(b.id) - gradeOf(a.id))

  push({ t: 0, type: 'camera', shot: 'overview' })
  log(0, 'dim', `# 시나리오: ${SCENARIOS.find((s) => s.id === scenario)!.name} · 가상 대전 ○○대학 정보화본부`)
  log(0, 'cmd', `drsim inject --scenario ${scenario} --site main`)

  let temp = ROOM_T0
  let shutdownStarted = false
  let nextShutdown = 0
  let shutIdx = 0
  let end = 0

  if (scenario === 'fire') {
    push({ t: 2, type: 'camera', shot: 'battery' })
    push({ t: 4, type: 'room', room: 'battery', state: 'fire' })
    push({ t: 4, type: 'banner', tone: 'danger', title: '배터리실 화재', sub: '배터리 이설 작업 중 통전 상태 해체 → 랙 사이 불꽃', hold: 5 })
    log(4, 'error', '배터리실 UPS-A 랙에서 불꽃 감지 (작업 중 통전 상태)')
    push({ t: 40, type: 'room', room: 'battery', state: 'no_access' })
    log(40, 'warn', '연기 확산 — 배터리실 출입 통제')
    push({ t: 70, type: 'room', room: 'battery', state: 'power_cut' })
    log(70, 'warn', '소방 안전 조치: 배터리실 분전반 전원 차단')
  } else {
    push({ t: 2, type: 'camera', shot: 'battery' })
    push({ t: 6, type: 'banner', tone: 'danger', title: 'UPS-A 인버터 고장', sub: '바이패스 전환 실패', hold: 4 })
    log(6, 'error', 'UPS-A 인버터 고장 — 바이패스 전환 실패')
  }

  for (let t = 0; t <= 900; t += DT) {
    // 화재 강도: 점화 후 서서히 커지다 진화
    if (scenario === 'fire' && t >= 4 && t % 10 === 0) {
      const k = Math.min(1, (t - 4) / 90)
      push({ t, type: 'fire', room: 'battery', intensity: Number(k.toFixed(2)) })
    }

    if (scenario === 'fire' && t === 70) {
      for (const i of topo.infra) {
        if (i.room === 'battery' || i.feed === 'ups-a') {
          infraOn[i.id] = false
          push({ t, type: 'infra', id: i.id, on: false })
        }
      }
      log(t, 'error', '항온항습기 1·2 정지 — 제어 전원이 배터리실 분전반 경유')
      for (const r of mainRacks) {
        racks[r.id] = 'bypass'
        push({ t, type: 'rack', id: r.id, state: 'bypass' })
      }
      log(t, 'warn', '서버 랙 전원: UPS 보호 없이 상용 바이패스로 운전')
      push({ t: t + 2, type: 'camera', shot: 'mainRoom' })
      push({ t: t + 2, type: 'banner', tone: 'warn', title: '냉각 상실', sub: '서버실 A 온도 상승 시작', hold: 3.5 })
    }

    if (scenario === 'ups' && t === 10) {
      for (const i of topo.infra) {
        if (i.id.startsWith('ups-a') || i.feed === 'ups-a') {
          infraOn[i.id] = false
          push({ t, type: 'infra', id: i.id, on: false })
        }
      }
      push({ t, type: 'camera', shot: 'mainRoom' })
      for (const [i, r] of mainRacks.entries()) setRack(t + i, r.id, 'off')
      log(t + 6, 'error', '서버실 A 전체 전원 상실')
      end = t + 40
      break
    }

    // 열수지: C·dT/dt = P(가동 랙 발열) − Q(냉각) − 벽체 손실
    const P = mainRacks.filter((r) => racks[r.id] !== 'off').reduce((a, r) => a + r.powerKw, 0)
    const Q = topo.infra
      .filter((i) => i.kind === 'crac' && i.coolsRoom === 'server-a' && infraOn[i.id])
      .reduce((a, i) => a + (i.coolingKw ?? 0), 0)
    const net = P - Math.min(Q, P) - PASSIVE_LOSS * (temp - ROOM_T0)
    temp = Math.max(ROOM_T0, temp + (net / HEAT_CAPACITY) * DT)
    if (t % 10 === 0) push({ t, type: 'temp', room: 'server-a', value: Number(temp.toFixed(1)) })

    if (!shutdownStarted && temp >= params.shutdownAtC) {
      shutdownStarted = true
      nextShutdown = t + 5
      push({ t, type: 'policy', text: `선제 셧다운 정책 발동 · 서버실 ${params.shutdownAtC}°C` })
      push({ t, type: 'banner', tone: 'danger', title: `선제 셧다운 · ${params.shutdownAtC}°C`, sub: '운영자가 하위 등급부터 서버를 내린다', hold: 4 })
      log(t, 'warn', `서버실 A ${temp.toFixed(1)}°C ≥ 정책 임계 ${params.shutdownAtC}°C → 선제 셧다운 시작`)
      push({ t: t + 1, type: 'camera', shot: 'logical' })
    }
    if (shutdownStarted && shutIdx < shutdownOrder.length && t >= nextShutdown) {
      const r = shutdownOrder[shutIdx++]
      log(t, 'cmd', `shutdown -h now   # ${r.id}`)
      setRack(t, r.id, 'off')
      nextShutdown = t + 10
      if (shutIdx === shutdownOrder.length) end = t + 30
    }
    if (end && t >= end) break
  }

  const down = topo.services.filter((s) => s.site === 'main' && resolved[s.id].state === 'down').length
  push({ t: end, type: 'banner', tone: 'danger', title: `주 전산실 서비스 ${down}개 중단`, sub: '이제 DR 전환 절차서를 실행해야 한다', hold: 6 })
  push({ t: end, type: 'camera', shot: 'overview' })
  log(end, 'info', `사고 종료 상태: 주 전산실 서비스 ${down}개 중단 · DR 센터 대기 중`)
  push({ t: end + 1, type: 'end', result: 'incident' })

  ev.sort((a, b) => a.t - b.t)
  return { events: ev, duration: end + 1, racks, own }
}
