import { useStore } from '../store'
import { countermeasures } from '../sim/model'
import { Icon } from './Icon'

export function Report() {
  const runs = useStore((s) => s.runs)
  const runFixes = useStore((s) => s.runFixes)
  const scenario = useStore((s) => s.scenario)
  const openFix = useStore((s) => s.openFix)
  const first = runs[0]
  const last = runs.at(-1)
  if (!first || !last) return null
  const download = () => {
    const data = { scenario, executor: 'mock', runs: runs.map((r, i) => ({ run: i + 1, fixes: runFixes[i] ?? [], pass: r.pass, blocked: r.blocked, totalMin: r.totalMin, autoSec: r.autoSec, humanMin: r.humanMin, lost: r.lost, writes: r.writes, degraded: r.degraded, discovered: r.discovered })) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'dr-rehearsal-report.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="report">
    <div className="comparison-grid">{[{ label: '기존 복구 계획', run: first, index: 0 }, { label: '개선 후', run: last, index: runs.length - 1 }].map(({ label, run, index }) =>
      <div key={label} className={'comparison-card ' + (index > 0 ? 'after' : '')}>
        <div className="comparison-title"><span>{label}</span><span className={'status-pill ' + (run.blocked ? 'danger' : run.pass ? 'ok' : 'warn')}>{run.blocked ? '전환 실패' : run.pass ? '목표 시간 충족' : '목표 시간 초과'}</span></div>
        <div className="comparison-metrics"><div><span>복구 시간</span><strong>{run.totalMin ?? '—'}<small>{run.totalMin === null ? '' : '분'}</small></strong></div><div><span>데이터 유실</span><strong className={run.lost ? 'danger' : 'ok'}>{run.lost}<small>건</small></strong></div></div>
        <p>{run.blocked ? '주 전산실 인증 중단으로 DR 로그인 실패' : '자동 ' + Math.ceil(run.autoSec / 60) + '분 + 사람 ' + run.humanMin + '분'}</p>
        {run.degraded.length > 0 && <p className="remaining-note">학사정보 연동 기능은 추가 개선이 필요합니다.</p>}
        <div className="applied-fixes">{(runFixes[index] ?? []).map((id) => <span key={id}>{countermeasures.find((c) => c.id === id)?.name}</span>)}</div>
      </div>,
    )}</div>
    <div className="report-history"><h2>검증 기록</h2><div className="table-scroll"><table><thead><tr><th>회차</th><th>적용 대책</th><th>복구 시간</th><th>데이터 유실</th><th>결과</th></tr></thead><tbody>
      {runs.map((r, i) => <tr key={i}><td>{i + 1}회</td><td>{(runFixes[i] ?? []).map((id) => countermeasures.find((c) => c.id === id)?.name).join(' · ') || '기존 복구 계획'}</td><td>{r.totalMin === null ? '전환 불가' : r.totalMin + '분'}</td><td>{r.lost}건</td><td className={r.blocked ? 'danger' : r.pass ? 'ok' : 'warn'}>{r.blocked ? '실패' : r.pass ? '시간 충족' : '시간 초과'}</td></tr>)}
    </tbody></table></div></div>
    <footer><div><button className="ghost" onClick={download}>JSON 저장</button><button className="ghost" onClick={() => window.print()}>인쇄</button></div><button className="cta" onClick={openFix}>대책 다시 선택<Icon name="arrow" /></button></footer>
  </section>
}
