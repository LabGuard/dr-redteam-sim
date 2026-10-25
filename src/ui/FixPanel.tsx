import { useMemo } from 'react'
import { useStore } from '../store'
import { applyFixes, baseTopology, countermeasures } from '../sim/model'
import { runRehearsal } from '../sim/rehearsal'
import { Icon } from './Icon'

const BENEFITS: Record<string, string> = {
  'auth-dual': 'DR 로그인 실패 해결',
  'db-sync': '데이터 유실 0건',
  'monitor-dr': '정상 확인 시간 10분 단축',
  'haksa-dr': '학사정보 연동 기능 복구',
}
const ORDER = ['auth-dual', 'db-sync', 'monitor-dr', 'haksa-dr']
const OPTIONS = ORDER.map((id) => countermeasures.find((c) => c.id === id)!)

export function FixPanel() {
  const budget = useStore((s) => s.budget)
  const setBudget = useStore((s) => s.setBudget)
  const draft = useStore((s) => s.draftFixes)
  const toggle = useStore((s) => s.toggleDraft)
  const apply = useStore((s) => s.applyAndRerun)
  const spent = countermeasures.filter((c) => draft.includes(c.id)).reduce((a, c) => a + c.costEok, 0)
  const over = spent > budget + 1e-9

  return <>
    <div className="flow-content fix-content">
      <div className="section-label">개선 대책 선택</div><h2>무엇부터 개선할까요?</h2>
      <label className="budget-control"><span>개선 예산<strong>{budget.toFixed(1)}<small>억 원</small></strong></span><input aria-label="개선 예산" type="range" min="1" max="8" step="0.5" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label>
      <div className="cm-list">{OPTIONS.map((c) => <label key={c.id} className={'cm ' + (draft.includes(c.id) ? 'on' : '')}>
        <input type="checkbox" checked={draft.includes(c.id)} onChange={() => toggle(c.id)} />
        <span><b>{c.name}</b><small>{BENEFITS[c.id]}</small></span><strong>{c.costEok.toFixed(1)}<small>억</small></strong>
      </label>)}</div>
      <div className={'budget-total ' + (over ? 'danger' : '')}><span>선택한 대책 합계</span><b>{spent.toFixed(1)} / {budget.toFixed(1)}억</b></div>

    </div>
    <div className="flow-action">{over && <p className="over-budget" role="status">예산을 초과했습니다. 대책을 조정하세요.</p>}<button className="cta" disabled={over || draft.length === 0} onClick={apply}>적용하고 다시 검증<Icon name="arrow" /></button></div>
  </>
}

export function FixPreview() {
  const draft = useStore((s) => s.draftFixes)
  const humanMin = useStore((s) => s.humanMin)
  const preview = useMemo(() => runRehearsal({ topo: applyFixes(baseTopology, draft), fixes: draft, humanMin, run: 0 }), [draft, humanMin])
  return <div className="scene-preview" aria-live="polite">
    <div><span>적용 후 예상</span><small>{preview.blocked ? '인증 이중화가 필요합니다' : preview.degraded.length ? '학사정보 연동 기능 저하가 남습니다' : '서비스 기능 저하 없음'}</small></div>
    <div><span>복구 시간</span><strong className={preview.blocked ? 'danger' : 'ok'}>{preview.blocked ? '전환 불가' : preview.totalMin}<small>{preview.blocked ? '' : '분'}</small></strong></div>
    <div><span>데이터 유실</span><strong className={preview.lost ? 'warn' : 'ok'}>{preview.lost}<small>건</small></strong></div>
  </div>
}
