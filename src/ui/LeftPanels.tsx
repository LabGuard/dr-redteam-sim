import { useMemo } from 'react'
import { useStore } from '../store'
import { analyze } from '../sim/analysis'
import { SCENARIOS } from '../sim/incident'
import { humanEstimate } from '../sim/rehearsal'
import { baseTopology, procedure } from '../sim/model'
import type { WorldState } from '../sim/world'

export function ScenarioPanel() {
  const scenario = useStore((s) => s.scenario)
  const setScenario = useStore((s) => s.setScenario)
  const shutdownAtC = useStore((s) => s.shutdownAtC)
  const setShutdown = useStore((s) => s.setShutdown)
  return (
    <section className="panel">
      <header>장애 시나리오</header>
      <div className="scenario-list">
        {SCENARIOS.map((s) => (
          <button key={s.id} className={`scenario ${scenario === s.id ? 'on' : ''}`} onClick={() => setScenario(s.id)}>
            <b>{s.id === 'fire' ? '🔥' : '⚡'} {s.name}</b>
            <span>{s.desc}</span>
          </button>
        ))}
      </div>
      {scenario === 'fire' && (
        <label className="slider">
          <span>선제 셧다운 정책 임계 <b>{shutdownAtC}°C</b></span>
          <input type="range" min={30} max={45} step={1} value={shutdownAtC} onChange={(e) => setShutdown(Number(e.target.value))} />
        </label>
      )}
    </section>
  )
}

export function FindingsPanel({ world }: { world: WorldState }) {
  const findings = useMemo(() => analyze(baseTopology), [])
  const found = world.edgesFound
  const authEscalated = found.some((e) => e.to === 'auth')
  const name = (id: string) => baseTopology.services.find((s) => s.id === id)?.name ?? id
  const sevLabel = { high: '높음', medium: '중간', low: '낮음' }
  return (
    <section className="panel findings">
      <header>
        정적 분석 <small>문서(계획서·CMDB) 기준</small>
      </header>
      <ul>
        {found.map((e) => (
          <li key={`f-${e.from}-${e.to}`} className="finding critical fresh">
            <em>실행으로 발견</em>
            <b>{name(e.from)} → {name(e.to)}</b>
            <span>계획서·CMDB에 없음{e.via ? ` · ${e.via}` : ''} — 정적 분석으로는 못 찾음</span>
          </li>
        ))}
        {findings.map((f) => {
          const escalated = f.id === 'cc-auth' && authEscalated
          return (
            <li key={f.id} className={`finding ${escalated ? 'critical' : f.severity}`}>
              <em>
                {f.kind} · {escalated ? <><s>{sevLabel[f.severity]}</s> → 치명</> : sevLabel[f.severity]}
              </em>
              <b>{f.title}</b>
              <span>{escalated ? 'DR 관리 콘솔이 실제로 의존 — 리허설에서 확인' : f.detail}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ProcedurePanel({ world }: { world: WorldState }) {
  const phase = useStore((s) => s.phase)
  const humanMin = useStore((s) => s.humanMin)
  const setHuman = useStore((s) => s.setHuman)
  const fixes = useStore((s) => s.fixes)
  const run = useStore((s) => s.runs.length)
  const editable = phase === 'idle' || phase === 'fix'
  return (
    <section className="panel procedure">
      <header>
        DR 전환 절차서 <small>dr-playbook-v3 · {run ? `${run}회차` : '실행 전'}</small>
      </header>
      <ol>
        {procedure.map((p) => {
          const s = world.steps[p.no]
          const state = s?.state ?? 'pending'
          const est = humanEstimate(p, phase === 'fix' ? [] : fixes, humanMin)
          return (
            <li key={p.no} className={`step ${state}`}>
              <i>{state === 'ok' ? '✓' : state === 'fail' ? '✕' : state === 'running' ? '' : p.no}</i>
              <div>
                <b>{p.name}</b>
                {s?.note && <span>{s.note}</span>}
              </div>
              <em className={p.mode}>
                {p.mode === 'human' ? (
                  editable ? (
                    <>
                      사람{' '}
                      <input type="number" min={0} max={240} value={humanMin[p.no] ?? p.estMin} onChange={(e) => setHuman(p.no, Number(e.target.value))} />
                      분
                    </>
                  ) : (
                    `사람 · 추정 ${est}분`
                  )
                ) : s?.measuredSec !== undefined ? (
                  `자동 · ${s.measuredSec}초`
                ) : (
                  '자동'
                )}
              </em>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
