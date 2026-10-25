import { useStore } from '../store'
import { A1_RTO_MIN, procedure } from '../sim/model'
import { PLAN_AUTO_ASSUMED_MIN } from '../sim/rehearsal'
import type { WorldState } from '../sim/world'
import { Icon } from './Icon'

const STEP_NAMES = ['전환 결정', '학사 DB 전환', '파일 저장소 전환', 'DR 관리 콘솔 로그인', '수강신청 · 포털 시작', '접속 경로 변경', '서비스 정상 확인']

export function FlowPanel({ world }: { world: WorldState }) {
  const phase = useStore((s) => s.phase)
  const scenario = useStore((s) => s.scenario)
  const setScenario = useStore((s) => s.setScenario)
  const shutdown = useStore((s) => s.shutdownAtC)
  const setShutdown = useStore((s) => s.setShutdown)
  const human = useStore((s) => s.humanMin)
  const setHuman = useStore((s) => s.setHuman)
  const startIncident = useStore((s) => s.startIncident)
  const startRehearsal = useStore((s) => s.startRehearsal)
  const openFix = useStore((s) => s.openFix)
  const openReport = useStore((s) => s.openReport)
  const done = useStore((s) => s.duration > 0 && s.t >= s.duration)
  const last = useStore((s) => s.runs.at(-1))
  const mainDown = Object.entries(world.services).filter(([id, s]) => !id.endsWith('-dr') && s.state === 'down').length
  const planMin = PLAN_AUTO_ASSUMED_MIN + procedure.filter((p) => p.mode === 'human').reduce((sum, p) => sum + (human[p.no] ?? p.estMin), 0)
  const failed = Object.values(world.steps).some((s) => s.state === 'fail')
  const incident = phase === 'incident'

  if (phase === 'idle') return <>
    <div className="flow-content">
      <div className="section-label">시나리오 선택</div><h2>어떤 상황을 재현할까요?</h2>
      <div className="scenario-list" role="group" aria-label="장애 시나리오">
        {(['fire', 'ups'] as const).map((id) => <button key={id} className={'scenario ' + (scenario === id ? 'on' : '')} aria-pressed={scenario === id} onClick={() => setScenario(id)}>
          <span className="scenario-icon"><Icon name={id === 'fire' ? 'fire' : 'power'} size={22} /></span>
          <span><b>{id === 'fire' ? '배터리실 화재' : 'UPS 고장'}</b><small>{id === 'fire' ? '냉각 중단 → 과열 → 서비스 중단' : '전원 상실 → 서비스 중단'}</small></span>
          <i className="radio-dot" />
        </button>)}
      </div>
      <div className="plan-summary"><span>복구 목표</span><strong>{A1_RTO_MIN}<small>분 이내</small></strong></div>
      <details className="disclosure"><summary>시뮬레이션 설정</summary><div>
        {scenario === 'fire' && <label className="slider"><span>서버 종료 온도 <b>{shutdown}°C</b></span><input aria-label="서버 종료 온도" type="range" min="30" max="45" value={shutdown} onChange={(e) => setShutdown(Number(e.target.value))} /></label>}
        {procedure.filter((p) => p.mode === 'human').map((p) => <label className="number-field" key={p.no}><span>{STEP_NAMES[p.no]}</span><span><input aria-label={STEP_NAMES[p.no] + ' 예상 시간'} type="number" min="0" max="240" value={human[p.no] ?? p.estMin} onChange={(e) => setHuman(p.no, Math.max(0, Math.min(240, Number(e.target.value))))} />분</span></label>)}
      </div></details>
    </div>
    <div className="flow-action"><button className="cta danger" onClick={startIncident}>사고 재현 시작<Icon name="play" size={16} /></button></div>
  </>

  return <>
    <div className="flow-content">
      <div className={'section-label ' + (failed ? 'danger' : done && !incident ? 'ok' : '')}>{incident ? done ? '사고 재현 완료' : '사고 재현 중' : failed ? '복구 검증 실패' : done ? '복구 검증 완료' : '복구 계획 실행 중'}</div>
      <h2>{incident ? done ? '주 전산실이 멈췄습니다' : scenario === 'fire' ? '화재가 확산되고 있습니다' : '전원이 차단됩니다' : failed ? 'DR에 로그인할 수 없습니다' : done ? 'DR 전환을 완료했습니다' : '계획서대로 복구합니다'}</h2>
      <p className="flow-description">{incident ? done ? '준비된 복구 계획으로 서비스를 되살릴 수 있는지 확인하세요.' : scenario === 'fire' ? '냉각이 멈추면 온도가 올라가고 서버가 순차적으로 종료됩니다.' : '전원 공급이 끊기면 연결된 서비스가 중단됩니다.' : failed ? 'DR 관리 콘솔이 중단된 주 전산실의 인증 서버에 의존하고 있습니다.' : done ? '복구 목표 ' + A1_RTO_MIN + '분' + (last?.pass ? ' 이내에 전환했습니다.' : '을 초과했습니다.') : '데이터와 서비스를 DR 센터로 전환하는 중입니다.'}</p>
      {incident ? <>
        <div className="incident-count"><strong>{mainDown}<small>/ 9</small></strong><span>중단된 서비스</span></div>
        <ol className="incident-progress">{(scenario === 'fire' ? [
          ['화재 발생', (world.fire.battery ?? 0) > 0], ['냉각 중단', world.infra['crac-1'] === false], ['서비스 중단', mainDown > 0],
        ] : [['전원 이상', mainDown > 0], ['서비스 중단', mainDown > 0]]).map(([label, active]) => <li className={active ? 'done' : ''} key={String(label)}><i>{active ? <Icon name="check" size={12} /> : ''}</i>{label}</li>)}</ol>
        {done && <div className="simple-note"><span>기존 계획의 예상 복구 시간</span><b>{planMin}분</b></div>}
      </> : <>
        {failed && <div className="failure-path"><span>DR 관리 콘솔</span><span className="danger">→</span><span>주 전산실 인증 <b>중단</b></span></div>}
        {!failed && !done && <ol className="compact-procedure">{procedure.map((p) => {
          const state = world.steps[p.no]?.state ?? 'pending'
          return <li className={state} key={p.no}><i>{state === 'ok' ? <Icon name="check" size={12} /> : p.no + 1}</i><span>{STEP_NAMES[p.no]}</span>{state === 'running' && <small>진행 중</small>}</li>
        })}</ol>}
        {(failed || done) && <>
          <div className="result-metrics"><div><span>복구 시간</span><strong className={last?.blocked ? 'danger' : 'ok'}>{last?.blocked ? '전환 불가' : last?.totalMin}<small>{last?.blocked ? '' : '분'}</small></strong></div><div><span>데이터 유실</span><strong className={world.rpo.lost ? 'danger' : 'ok'}>{world.rpo.lost}<small>건</small></strong></div></div>
          {failed && <div className="simple-note">인증 서버를 DR 센터에도 두면 복구를 계속할 수 있습니다.</div>}
          {done && !!last?.degraded.length && <p className="remaining-note"><Icon name="info" size={15} />학사정보 연동은 추가 개선이 필요합니다.</p>}
          {done && !last?.blocked && !!last?.lost && <p className="remaining-note"><Icon name="info" size={15} />데이터 유실을 줄이려면 동기 복제를 적용하세요.</p>}
        </>}
      </>}
    </div>
    <div className="flow-action">
      {incident ? <button className="cta" disabled={!done} onClick={startRehearsal}>복구 계획 검증<Icon name="arrow" /></button> : phase === 'rehearsal' ? <button className="cta" disabled={!done} onClick={openFix}>개선 대책 선택<Icon name="arrow" /></button> : <><button className="cta" disabled={!done} onClick={openReport}>결과 비교<Icon name="arrow" /></button>{done && <button className="text-button secondary-action" onClick={openFix}>대책 다시 선택</button>}</>}
    </div>
  </>
}
