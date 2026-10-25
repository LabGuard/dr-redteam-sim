import { A1_RTO_MIN, procedure as baseProcedure, type ProcedureStep, type Topology } from './model'
import type { ServiceState, SimEvent } from './events'
import { resolveAvailability } from './graph'

// 모의 실행기. 실제 실행기(컨테이너 장애 주입)가 붙으면 같은 SimEvent를 WebSocket으로 보낸다.
// 판정은 대본이 아니라 계산이다: 단계마다 "실제 환경" 의존 그래프로 선행 조건을 확인하고,
// 실패 원인 에지가 문서에 없으면 숨은 의존으로 보고한다.

export const PLAN_AUTO_ASSUMED_MIN = 10 // 계획서가 자동 단계에 가정한 시간

export interface RehearsalInput {
  topo: Topology
  fixes: string[]
  humanMin: Record<number, number> // 사람 단계 추정(기관 입력)
  run: number
}

export interface RehearsalResult {
  events: SimEvent[]
  duration: number
  pass: boolean
  blocked: boolean
  failedStep: number | null
  autoSec: number
  humanMin: number
  totalMin: number | null
  writes: number
  lost: number
  degraded: string[]
  discovered: { from: string; to: string; via?: string }[]
}

const WRITE_RATE = 12.4 // 부하 생성기 초당 쓰기
const LOAD_SEC = 100
// 자동 단계 소요(초). 모의 값 — 실제 실행기가 붙으면 실측으로 바뀐다.
const AUTO_SEC: Record<string, number> = { promote: 38, login: 6, start: 44, dns: 14 }

export function humanEstimate(step: ProcedureStep, fixes: string[], humanMin: Record<number, number>) {
  const base = humanMin[step.no] ?? step.estMin
  if (step.action === 'verify' && fixes.includes('monitor-dr')) return Math.max(0, base - 10)
  return base
}

export function runRehearsal({ topo, fixes, humanMin, run }: RehearsalInput): RehearsalResult {
  const ev: SimEvent[] = []
  const push = (e: SimEvent) => ev.push(e)
  const log = (t: number, level: Extract<SimEvent, { type: 'log' }>['level'], text: string) => push({ t, type: 'log', level, text })
  const name = (id: string) => topo.services.find((s) => s.id === id)?.name ?? id
  const steps = baseProcedure

  // 사고 후 상태에서 시작: 주 전산실은 꺼져 있고, DR은 대기
  const own: Record<string, ServiceState> = Object.fromEntries(
    topo.services.map((s) => [s.id, (s.site === 'main' ? 'down' : s.hot ? 'up' : 'standby') as ServiceState]),
  )
  const documented = topo.edges.filter((e) => e.documented)
  let shown = resolveAvailability(topo, own)

  const sync = (t: number) => {
    const next = resolveAvailability(topo, own)
    for (const s of topo.services) {
      if (shown[s.id].state !== next[s.id].state) push({ t, type: 'service', id: s.id, state: next[s.id].state, reason: next[s.id].reason })
    }
    shown = next
  }

  const humanTotal = steps.filter((s) => s.mode === 'human').reduce((a, s) => a + humanEstimate(s, fixes, humanMin), 0)
  const planMin = PLAN_AUTO_ASSUMED_MIN + humanTotal

  push({ t: 0, type: 'camera', shot: 'drSite' })
  log(0, 'dim', `# 리허설 ${run}회차 · 절차서 dr-playbook-v3 (7단계)${fixes.length ? ` · 적용 대책 ${fixes.length}개` : ''}`)
  push({
    t: 0,
    type: 'prediction',
    result: planMin <= A1_RTO_MIN ? 'pass' : 'fail',
    minutes: planMin,
    note: `계획서 기준 (자동 ${PLAN_AUTO_ASSUMED_MIN}분 가정 + 사람 ${humanTotal}분)`,
  })

  // 장애 주입 직전까지 쓰기 부하
  const writes = Math.round(WRITE_RATE * LOAD_SEC)
  log(0, 'cmd', `loadgen --target db --rate ${WRITE_RATE}/s --duration ${LOAD_SEC}s`)
  for (let i = 1; i <= 4; i++) push({ t: i * 0.5, type: 'rpo', writes: Math.round((writes * i) / 4), lost: 0 })
  log(2, 'cmd', 'drsim fault apply --from-incident   # 주 전산실 구성요소 중지')
  log(2.5, 'info', `쓰기 ${writes.toLocaleString()}건 확인 · 주 사이트 중지됨`)

  let t = 4
  let autoSec = 0
  let failedStep: number | null = null
  let lost = 0
  const discovered: RehearsalResult['discovered'] = []

  for (const step of steps) {
    push({ t, type: 'step', no: step.no, state: 'running' })
    log(t, 'info', `[${step.no}] ${step.name}`)

    if (step.mode === 'human') {
      const est = humanEstimate(step, fixes, humanMin)
      const note = step.action === 'verify' && !topo.services.some((s) => s.id === 'monitor-dr')
        ? `추정 ${est}분 · DR에 관제 없음 → 수동 점검`
        : `추정 ${est}분 (기관 입력)`
      t += 2.5
      push({ t, type: 'step', no: step.no, state: 'ok', note })
      log(t, 'dim', `    사람 단계 — ${note}`)
      t += 0.5
      continue
    }

    const dur = AUTO_SEC[step.action!] ?? 10
    const targets = step.targets ?? []

    if (step.action === 'promote') {
      log(t, 'cmd', `dr exec promote ${targets.join(' ')}`)
      for (const id of targets) own[id] = 'starting'
      sync(t)
      t += dur
      for (const id of targets) own[id] = 'up'
      sync(t)
      const rep = topo.replication.find((r) => targets.includes(r.to))
      if (rep && rep.to === 'db-dr') {
        lost = Math.round(WRITE_RATE * rep.lagSec)
        push({ t, type: 'rpo', writes, lost })
        log(t, lost ? 'warn' : 'ok', `    복제본 행 수 ${(writes - lost).toLocaleString()} / ${writes.toLocaleString()} — ${rep.mode === 'sync' ? '동기 복제' : `복제 지연 ${rep.lagSec}초`} → 유실 ${lost}건`)
      }
    } else if (step.action === 'login') {
      log(t, 'cmd', `dr exec login --console ${targets[0]} --user dr-operator`)
      t += dur
    } else if (step.action === 'start') {
      log(t, 'cmd', `dr exec start ${targets.join(' ')}`)
      for (const id of targets) own[id] = 'starting'
      sync(t)
      t += dur
      for (const id of targets) own[id] = 'up'
      sync(t)
    } else if (step.action === 'dns') {
      log(t, 'cmd', 'dr exec dns switch --zone univ.ac.kr --to dr')
      t += dur
    }

    // 선행 조건: 대상이 실제 환경 기준으로 쓸 수 있어야 한다
    const truth = resolveAvailability(topo, own)
    const plan = resolveAvailability(topo, own, documented)
    const broken = targets.filter((id) => truth[id].state === 'down')
    if (broken.length) {
      const id = broken[0]
      const cause = topo.edges.find((e) => e.from === id && e.kind === 'hard' && truth[e.to].state !== 'up')
      const hidden = cause && !cause.documented && plan[id].state === 'up'
      const msg = step.action === 'login' ? '로그인 불가' : '기동 실패'
      push({ t, type: 'step', no: step.no, state: 'fail', measuredSec: dur, note: `${msg} — ${cause ? `${name(cause.to)} 응답 없음` : '원인 미상'}` })
      log(t, 'error', `    ✗ ${msg}: ${name(id)} → ${cause ? `${name(cause.to)} (주 사이트, 중지됨)` : '?'}`)
      if (cause && hidden) {
        discovered.push({ from: cause.from, to: cause.to, via: cause.via })
        push({ t: t + 0.6, type: 'edge_found', from: cause.from, to: cause.to, via: cause.via })
        push({ t: t + 0.6, type: 'camera', shot: 'edge' })
        log(t + 0.6, 'warn', `    ! 계획서·CMDB에 없는 의존 발견: ${name(cause.from)} → ${name(cause.to)}${cause.via ? ` (${cause.via})` : ''}`)
        push({ t: t + 0.6, type: 'banner', tone: 'danger', title: `${step.no}단계 실패 · ${msg}`, sub: `계획서에 없던 의존: ${name(cause.from)} → ${name(cause.to)} (주 사이트)`, hold: 6 })
      } else {
        push({ t: t + 0.6, type: 'banner', tone: 'danger', title: `${step.no}단계 실패 · ${msg}`, sub: cause ? `${name(cause.to)} 응답 없음` : undefined, hold: 6 })
      }
      push({ t: t + 2.2, type: 'prediction', result: 'blocked', minutes: null, note: `${step.no}단계에서 막힘 → 이후 단계 실행 불가` })
      log(t + 2.2, 'error', `    재예측: A1 목표 ${A1_RTO_MIN}분 → 미달 (전환 불가)`)
      autoSec += dur
      failedStep = step.no
      for (const s of steps) if (s.no > step.no) push({ t: t + 2.2, type: 'step', no: s.no, state: 'skipped' })
      t += 3
      break
    }

    autoSec += dur
    const degraded = targets.filter((id) => truth[id].state === 'degraded')
    push({ t, type: 'step', no: step.no, state: 'ok', measuredSec: dur, note: degraded.length ? truth[degraded[0]].reason : undefined })
    log(t, 'ok', `    ✓ 완료 ${dur}초${degraded.length ? ` · ${name(degraded[0])} ${truth[degraded[0]].reason}` : ''}`)
    t += 0.5
  }

  const final = resolveAvailability(topo, own)
  const degraded = topo.services.filter((s) => s.site === 'dr' && final[s.id].state === 'degraded').map((s) => s.id)
  const blocked = failedStep !== null
  const autoMin = Math.ceil(autoSec / 60)
  const totalMin = blocked ? null : autoMin + humanTotal
  const pass = !blocked && totalMin! <= A1_RTO_MIN

  if (!blocked) {
    push({ t, type: 'prediction', result: pass ? 'pass' : 'fail', minutes: totalMin, note: `자동 ${autoMin}분 + 사람 ${humanTotal}분 (추정)` })
    push({ t, type: 'camera', shot: 'recovered' })
    push({
      t,
      type: 'banner',
      tone: pass ? 'ok' : 'warn',
      title: pass ? `전환 성공 · ${totalMin}분 · A1 통과` : `전환은 됐지만 ${totalMin}분 · A1 초과`,
      sub: `자동 ${autoMin}분 + 사람 ${humanTotal}분${lost ? ` · 유실 ${lost}건` : ' · 유실 0건'}${degraded.length ? ` · 기능 저하 ${degraded.length}개` : ''}`,
      hold: 7,
    })
    log(t, pass ? 'ok' : 'warn', `전환 ${pass ? '성공' : '완료(목표 초과)'} — 자동 ${autoSec}초(≈${autoMin}분) + 사람 ${humanTotal}분 = ${totalMin}분`)
  }
  push({ t: t + 1, type: 'end', result: pass ? 'pass' : 'fail' })
  ev.sort((a, b) => a.t - b.t)

  return { events: ev, duration: t + 1, pass, blocked, failedStep, autoSec, humanMin: humanTotal, totalMin, writes, lost, degraded, discovered }
}
