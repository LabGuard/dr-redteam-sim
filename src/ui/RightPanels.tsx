import { useMemo } from 'react'
import { useStore } from '../store'
import { A1_RTO_MIN, procedure } from '../sim/model'
import { PLAN_AUTO_ASSUMED_MIN } from '../sim/rehearsal'
import type { SimEvent } from '../sim/events'
import type { WorldState } from '../sim/world'

export function TempPanel({ world }: { world: WorldState }) {
  const baseEvents = useStore((s) => s.baseEvents)
  const events = useStore((s) => s.events)
  const phase = useStore((s) => s.phase)
  const t = useStore((s) => s.t)
  const threshold = useStore((s) => s.shutdownAtC)
  const temp = world.temp['server-a'] ?? 23
  const cooling = world.infra['crac-1'] || world.infra['crac-2']

  const series = useMemo(() => {
    const src: SimEvent[] = phase === 'incident' ? events : baseEvents
    const limit = phase === 'incident' ? t : Infinity
    return src.filter((e): e is Extract<SimEvent, { type: 'temp' }> => e.type === 'temp' && e.t <= limit)
  }, [baseEvents, events, phase, t])
  const total = (phase === 'incident' ? events : baseEvents).at(-1)?.t ?? 400

  const W = 248
  const H = 64
  const y = (v: number) => H - ((v - 20) / 25) * H
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${((p.t / total) * W).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const tone = temp >= threshold ? 'danger' : temp >= 28 ? 'warn' : 'ok'

  return (
    <section className="panel">
      <header>
        서버실 A 온도 <small>C·dT/dt = P − Q</small>
      </header>
      <div className="temp-row">
        <div className={`big ${tone}`}>
          {temp.toFixed(1)}
          <small>°C</small>
        </div>
        <div className="temp-meta">
          <span className={cooling ? 'ok' : 'danger'}>냉각 {cooling ? '정상' : '정지'}</span>
          <span>셧다운 임계 {threshold}°C</span>
        </div>
      </div>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} className="thr" />
        <path d={path} className="line" />
      </svg>
      {world.policy && <div className="policy">⚠ {world.policy}</div>}
    </section>
  )
}

export function ServicesPanel({ world }: { world: WorldState }) {
  const topo = useStore((s) => s.topo)
  const rows = (['main', 'dr'] as const).map((site) => {
    const list = topo.services.filter((s) => s.site === site)
    const up = list.filter((s) => world.services[s.id]?.state === 'up').length
    const down = list.filter((s) => world.services[s.id]?.state === 'down').length
    return { site, list, up, down }
  })
  return (
    <section className="panel">
      <header>서비스 상태</header>
      {rows.map((r) => (
        <div key={r.site} className="svc-row">
          <div className="svc-row-head">
            <b>{r.site === 'main' ? '주 전산실' : 'DR 센터'}</b>
            <span>
              가동 <em className="ok">{r.up}</em> · 중단 <em className="danger">{r.down}</em>
            </span>
          </div>
          <div className="dots">
            {r.list.map((s) => (
              <i key={s.id} className={world.services[s.id]?.state ?? 'standby'} title={`${s.name} (${s.grade}) · ${world.services[s.id]?.state}`} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export function PredictionPanel({ world }: { world: WorldState }) {
  const humanMin = useStore((s) => s.humanMin)
  const planMin = PLAN_AUTO_ASSUMED_MIN + procedure.filter((s) => s.mode === 'human').reduce((a, s) => a + (humanMin[s.no] ?? s.estMin), 0)
  const p = world.prediction ?? {
    result: planMin <= A1_RTO_MIN ? ('pass' as const) : ('fail' as const),
    minutes: planMin,
    note: '계획서 기준 · 아직 실제로 돌려 본 적 없음',
    at: 0,
  }
  const label = p.result === 'blocked' ? '전환 불가' : `${p.minutes}분 · ${p.result === 'pass' ? '목표 이내' : '목표 초과'}`
  const tone = p.result === 'pass' ? 'ok' : 'danger'
  return (
    <section className={`panel prediction ${tone}`}>
      <header>
        복구 시간 예측 <small>{A1_RTO_MIN}분 이내 복구</small>
      </header>
      <div className={`verdict ${tone}`}>{label}</div>
      <div className="note">{p?.note ?? '리허설 전 — 계획서 수치만 있음'}</div>
    </section>
  )
}

export function RpoPanel({ world }: { world: WorldState }) {
  const { writes, lost } = world.rpo
  return (
    <section className="panel">
      <header>
        데이터 유실 <small>RPO · 전환 중 쓰기 부하</small>
      </header>
      <div className="rpo">
        <div className={`big ${lost ? 'danger' : 'ok'}`}>
          {writes ? lost : '—'}
          <small>건 유실</small>
        </div>
        <span>쓰기 {writes.toLocaleString()}건</span>
      </div>
      <div className="bar">
        <i style={{ width: writes ? `${((writes - lost) / writes) * 100}%` : '0%' }} />
        <b style={{ width: writes ? `${(lost / writes) * 100}%` : '0%' }} />
      </div>
    </section>
  )
}

export function TimePanel({ world }: { world: WorldState }) {
  const runs = useStore((s) => s.runs)
  const phase = useStore((s) => s.phase)
  const t = useStore((s) => s.t)
  const duration = useStore((s) => s.duration)
  const r = runs.at(-1)
  if (!r) return <section className="panel"><header>복구 시간 구성</header><p className="metric-note">복구 검증 후 자동 단계와 사람 단계의 시간을 확인할 수 있습니다.</p></section>
  const autoSec = Object.values(world.steps).reduce((a, s) => a + (s.measuredSec ?? 0), 0)
  const autoMin = autoSec / 60
  const done = phase !== 'rehearsal' && phase !== 'rerun' ? true : t >= duration
  const human = done && !r.blocked ? r.humanMin : 0
  const scale = Math.max(90, autoMin + human)
  return (
    <section className="panel">
      <header>
        복구 시간 <small>자동 모의 값 + 사람 추정</small>
      </header>
      <div className="timebar">
        <i className="auto" style={{ width: `${(autoMin / scale) * 100}%` }} />
        <i className="human" style={{ width: `${(human / scale) * 100}%` }} />
        <b style={{ left: `${(A1_RTO_MIN / scale) * 100}%` }} />
      </div>
      <div className="time-legend">
        <span className="auto">자동 {autoSec}초</span>
        <span className="human">사람 {human ? `${human}분 (추정)` : '—'}</span>
        <span>A1 {A1_RTO_MIN}분</span>
      </div>
      {r.blocked && done && <div className="policy">관리 콘솔 로그인 실패로 복구 시간 산정 불가</div>}
    </section>
  )
}
