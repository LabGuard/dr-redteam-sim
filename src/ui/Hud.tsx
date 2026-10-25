import { useState } from 'react'
import { useStore, useWorld, type Phase } from '../store'
import { World } from '../scene/World'
import type { WorldState } from '../sim/world'
import { Timeline } from './Bottom'
import { FlowPanel } from './FlowPanel'
import { FixPanel, FixPreview } from './FixPanel'
import { Details } from './Details'
import { Report } from './Report'
import { Icon } from './Icon'
import { ObjectDetails } from './ObjectDetails'
import { sceneTransition } from '../scene/transitions'

const STEPS = ['사고 재현', '복구 검증', '개선 · 재실행', '결과 비교']
const stepIndex = (p: Phase) => p === 'idle' || p === 'incident' ? 0 : p === 'rehearsal' ? 1 : p === 'report' ? 3 : 2
const DESCRIPTIONS = [
  '장애가 서비스에 미치는 영향을 확인하세요.',
  '기존 복구 계획이 실제 상황에서도 작동하는지 확인하세요.',
  '예산에 맞는 대책을 적용하고 다시 검증하세요.',
  '개선 전후의 복구 시간과 데이터 유실을 비교하세요.',
]

function SiteStatus({ world }: { world: WorldState }) {
  const topo = useStore((s) => s.topo)
  const selectObject = useStore((s) => s.selectObject)
  return <div className="site-status">{(['main', 'dr'] as const).map((site) => {
    const list = topo.services.filter((s) => s.site === site)
    const down = list.filter((s) => world.services[s.id]?.state === 'down').length
    const up = list.filter((s) => ['up', 'degraded'].includes(world.services[s.id]?.state)).length
    return <button key={site} className={'site-status-item ' + site} onClick={() => selectObject({ kind: 'site', id: site })} aria-label={(site === 'main' ? '주 전산실' : 'DR 센터') + ' 시설 정보'}>
      <span className={'status-dot ' + (down === list.length ? 'down' : 'up')} />
      <b>{site === 'main' ? '주 전산실' : 'DR 센터'}</b>
      <span>{down === list.length ? '서비스 중단' : site === 'main' ? up + '개 가동' : up + '개 가동 · ' + (list.length - up - down) + '개 대기'}</span>
    </button>
  })}</div>
}

export function Hud() {
  const world = useWorld()
  const topo = useStore((s) => s.topo)
  const phase = useStore((s) => s.phase)
  const scenario = useStore((s) => s.scenario)
  const reset = useStore((s) => s.reset)
  const showServices = useStore((s) => s.showServices)
  const setShowServices = useStore((s) => s.setShowServices)
  const cameraReset = useStore((s) => s.resetCamera)
  const selection = useStore((s) => s.selection)
  const selectObject = useStore((s) => s.selectObject)
  const [details, setDetails] = useState(false)
  const idx = stepIndex(phase)
  const transition = sceneTransition(topo, world, phase)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><i className="logo" /><b>DR REDTEAM</b></div>
      <nav aria-label="시연 진행 단계"><ol className="stepper">{STEPS.map((step, i) =>
        <li key={step} className={i < idx ? 'done' : i === idx ? 'on' : ''} aria-current={i === idx ? 'step' : undefined}>
          <i>{i < idx ? <Icon name="check" size={12} /> : i + 1}</i><span>{step}</span>
        </li>,
      )}</ol></nav>
      <button className="text-button reset-button" onClick={reset}><Icon name="reset" size={15} /><span>처음으로</span></button>
    </header>
    <main className={'workspace phase-' + phase}>
      <div className="page-heading">
        <div><div className="eyebrow">STEP {String(idx + 1).padStart(2, '0')}</div><h1>{STEPS[idx]}</h1><p>{DESCRIPTIONS[idx]}</p></div>
        <button className="ghost" title="서비스 · 지표 · 복구 절차 · 분석 · 실행 로그" onClick={() => setDetails(true)}><Icon name="info" size={16} />상세 보기</button>
      </div>
      {phase === 'report' ? <Report /> : <div className="workspace-grid">
        <section className="scene-card" aria-label="데이터센터 3D 시뮬레이션">
          <div className="scene-toolbar"><span><i className="live-dot" />데이터센터</span><div>
            <button className={'text-button ' + (showServices ? 'active' : '')} aria-pressed={showServices} onClick={() => setShowServices(!showServices)}><Icon name="layers" size={15} />서비스 연결</button>
            <button className="icon-button" aria-label="전체 시점으로" title="전체 시점으로" onClick={cameraReset}><Icon name="reset" size={15} /></button>
          </div></div>
          <div className="scene-viewport">
            <World />
            <div className="scene-note"><span className="scenario-chip">{scenario === 'fire' ? '배터리실 화재' : 'UPS 고장'}</span>{transition ? <div className={'transition-caption ' + transition.state}><span>{transition.action}</span><b>{transition.fromLabel}<i aria-hidden="true">{transition.state === 'blocked' ? '⇢ ×' : '→'}</i>{transition.toLabel}</b></div> : phase === 'incident' && <span className="temperature">서버실 {(world.temp['server-a'] ?? 23).toFixed(1)}°C</span>}</div>
            <SiteStatus world={world} />
          </div>
          {phase === 'fix' ? <FixPreview /> : phase === 'idle' ? <div className="scene-footer"><span className="legend"><i className="up" />정상<i className="standby" />대기<i className="down" />중단</span><span>건물·장비 클릭으로 정보 보기 · 드래그로 회전</span></div> : <Timeline />}
        </section>
        <aside className="flow-card" aria-label="현재 단계">{phase === 'fix' ? <FixPanel /> : <FlowPanel world={world} />}</aside>
      </div>}
    </main>
    {details && <Details world={world} onClose={() => setDetails(false)} />}
    {selection && <ObjectDetails selection={selection} world={world} onMore={() => { selectObject(null); setDetails(true) }} />}
  </div>
}
