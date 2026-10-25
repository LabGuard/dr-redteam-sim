import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { WorldState } from '../sim/world'
import { FindingsPanel, ProcedurePanel } from './LeftPanels'
import { Terminal } from './Bottom'
import { Icon } from './Icon'
import { PredictionPanel, RpoPanel, TempPanel, TimePanel } from './RightPanels'

const TABS = ['서비스', '지표', '복구 절차', '분석', '실행 로그']
const STATE_NAMES = { up: '정상', down: '중단', standby: '대기', starting: '전환 중', degraded: '기능 저하' }

export function Details({ world, onClose }: { world: WorldState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState(0)
  const topo = useStore((s) => s.topo)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="details-dialog" aria-labelledby="details-title" onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <header><div><h2 id="details-title">시뮬레이션 상세</h2><p>가상 환경 · 자동 단계는 모의 값, 사람 단계는 입력한 예상 시간입니다.</p></div><button className="icon-button" aria-label="상세 닫기" onClick={onClose}><Icon name="close" /></button></header>
      <div className="detail-tabs" role="group" aria-label="상세 항목">{TABS.map((label, i) => <button key={label} className={tab === i ? 'on' : ''} aria-pressed={tab === i} onClick={() => setTab(i)}>{label}</button>)}</div>
      <div className="detail-body">
        {tab === 0 && <div className="service-tables">{(['main', 'dr'] as const).map((site) => <section key={site}><h3>{site === 'main' ? '주 전산실' : 'DR 센터'}</h3><ul>{topo.services.filter((s) => s.site === site).map((s) => <li key={s.id}><span>{s.name}<small>{s.grade}</small></span><b className={world.services[s.id]?.state}>{STATE_NAMES[world.services[s.id]?.state ?? 'standby']}</b></li>)}</ul></section>)}</div>}
        {tab === 1 && <div className="detail-metrics"><PredictionPanel world={world} /><TempPanel world={world} /><RpoPanel world={world} /><TimePanel world={world} /></div>}
        {tab === 2 && <ProcedurePanel world={world} />}
        {tab === 3 && <FindingsPanel world={world} />}
        {tab === 4 && <Terminal world={world} />}
      </div>
    </div>
  </dialog>
}
