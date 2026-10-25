import { useEffect, useRef } from 'react'
import { useStore, type SceneSelection } from '../store'
import { SITE_LABEL, type SiteId } from '../sim/model'
import type { WorldState } from '../sim/world'
import { Icon } from './Icon'

const STATES = { up: '정상', down: '중단', standby: '대기', starting: '전환 중', degraded: '기능 저하' }
const SERVICE_ROLES: Record<string, string> = {
  auth: '사용자의 로그인을 확인하고, 다른 서비스에도 같은 계정으로 접속할 수 있게 합니다.',
  dns: '접속 주소를 실제 서버로 안내합니다. DR 전환 시 사용자가 접속할 서버의 위치를 바꿉니다.',
  db: '학적, 수강신청 등 서비스의 핵심 데이터를 저장합니다.',
  monitor: '서버와 서비스 상태를 관찰해 장애를 알아차리고, 복구 후 정상 작동을 확인합니다.',
  storage: '강의 자료와 첨부파일 같은 파일을 보관합니다.',
  sugang: '학생이 과목을 조회하고 수강신청하는 서비스입니다.',
  portal: '학교의 여러 정보와 서비스를 한곳에서 이용하는 통합 창구입니다.',
  haksa: '학적·학생 정보를 다른 서비스에 제공합니다. 수강신청도 이 정보를 사용합니다.',
  lms: '온라인 강의와 학습 자료를 제공하는 서비스입니다.',
  console: '관리자가 DR 센터에서 데이터와 서비스를 복구하도록 조작하는 관리 화면입니다.',
}
const ROOM_ROLES: Record<string, string> = {
  battery: '서버와 냉각 장비에 전력을 공급하는 UPS 배터리를 둔 공간입니다. 화재 시 전원과 냉각에 영향을 줄 수 있습니다.',
  'server-a': '학교 서비스를 평소에 운영하는 서버실입니다. 서버 랙과 냉각기가 있으며, 과열되면 장비 보호를 위해 서버가 종료됩니다.',
  'dr-server': '주 전산실에 장애가 생겼을 때 서비스를 대신 운영할 서버실입니다. 복제된 데이터와 대기 서버를 사용해 복구합니다.',
}
type LinkItem = { selection: SceneSelection; name: string; note: string }

export function ObjectDetails({ selection, world, onMore }: { selection: SceneSelection; world: WorldState; onMore: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const topo = useStore((s) => s.topo)
  const select = useStore((s) => s.selectObject)
  const rack = selection.kind === 'rack' ? topo.racks.find((r) => r.id === selection.id) : undefined
  const infra = selection.kind === 'infra' ? topo.infra.find((i) => i.id === selection.id) : undefined
  const service = selection.kind === 'service' ? topo.services.find((s) => s.id === selection.id) : undefined
  const serviceRack = service ? topo.racks.find((r) => r.id === service.rack) : undefined
  const roomId = selection.kind === 'room' ? selection.id : rack?.room ?? infra?.room ?? serviceRack?.room
  const room = topo.rooms.find((r) => r.id === roomId)
  const site = (selection.kind === 'site' ? selection.id : room?.site ?? service?.site ?? 'main') as SiteId
  const rooms = topo.rooms.filter((r) => selection.kind === 'site' ? r.site === site : r.id === roomId)
  const racks = topo.racks.filter((r) => rack ? r.id === rack.id : rooms.some((rm) => rm.id === r.room))
  const equipment = topo.infra.filter((i) => rooms.some((rm) => rm.id === i.room))
  const services = service ? [service] : infra ? [] : topo.services.filter((s) => racks.some((r) => r.id === s.rack))
  const links: LinkItem[] = []
  const stats: { label: string; value: string }[] = []
  let parent: SceneSelection | null = null
  let parentName = ''
  let title = ''
  let description = ''
  let status = ''
  let tone = 'ok'
  let category = ''

  if (selection.kind === 'site') {
    title = SITE_LABEL[site]
    category = site === 'main' ? '평상시 운영' : '재해복구'
    description = site === 'main' ? '학교 서비스를 평소에 운영하는 주 전산실입니다. 배터리실과 서버실로 구성되어 있습니다.' : '주 전산실과 떨어진 곳에 마련한 예비 운영 거점입니다. 장애 발생 시 이곳의 서버와 복제 데이터로 서비스를 이어갑니다.'
    const down = services.filter((s) => world.services[s.id]?.state === 'down').length
    const waiting = services.filter((s) => world.services[s.id]?.state === 'standby').length
    const degraded = services.some((s) => world.services[s.id]?.state === 'degraded')
    status = down === services.length ? '서비스 중단' : down ? '일부 중단' + (waiting ? ' · 복구 대기' : '') : waiting ? '가동 · 복구 대기' : degraded ? '일부 기능 저하' : '가동 중'
    tone = down ? 'danger' : degraded ? 'warn' : 'ok'
    stats.push({ label: '공간', value: rooms.length + '개' }, { label: '서버 랙', value: racks.length + '대' }, { label: '서비스', value: services.length + '개' })
    rooms.forEach((r) => links.push({ selection: { kind: 'room', id: r.id }, name: r.name, note: r.kind === 'battery' ? '전원 공급' : r.site === 'main' ? '서비스 운영' : '복구 · 대기' }))
  } else if (selection.kind === 'room' && room) {
    parent = { kind: 'site', id: site }; parentName = SITE_LABEL[site]
    title = room.name; category = room.kind === 'battery' ? '전원 공간' : '서버 공간'
    description = ROOM_ROLES[room.id] ?? '서버와 기반 장비를 운영하는 공간입니다.'
    const roomState = world.rooms[room.id]
    const off = racks.length > 0 && racks.every((r) => world.racks[r.id] === 'off')
    status = roomState === 'fire' ? '화재' : roomState === 'no_access' ? '출입 통제' : roomState === 'power_cut' ? '전원 차단' : off ? '서버 중단' : '정상'
    tone = status === '정상' ? 'ok' : 'danger'
    if (room.kind === 'server') stats.push({ label: '실내 온도', value: (world.temp[room.id] ?? 23).toFixed(1) + '°C' }, { label: '서버 랙', value: racks.length + '대' }, { label: '서비스', value: services.length + '개' })
    else stats.push({ label: '전원 장비', value: equipment.length + '대' })
    equipment.forEach((i) => links.push({ selection: { kind: 'infra', id: i.id }, name: i.name, note: i.kind === 'ups' ? '배터리 · 전원' : '냉각 장비' }))
    racks.forEach((r) => links.push({ selection: { kind: 'rack', id: r.id }, name: '서버 랙 ' + r.id, note: topo.services.filter((s) => s.rack === r.id).map((s) => s.name).join(' · ') }))
  } else if (rack) {
    parent = { kind: 'room', id: rack.room }; parentName = room?.name ?? rack.room
    title = '서버 랙 ' + rack.id; category = '서버 장비'
    description = '서비스를 실행하는 서버들을 모아 놓은 장비 캐비닛입니다. 이 랙이 꺼지면 아래 서비스도 영향을 받습니다.'
    status = world.racks[rack.id] === 'off' ? '서버 중단' : world.racks[rack.id] === 'bypass' ? '우회 전원 사용' : '가동 중'
    tone = world.racks[rack.id] === 'off' ? 'danger' : world.racks[rack.id] === 'bypass' ? 'warn' : 'ok'
    stats.push({ label: '서비스', value: services.length + '개' }, { label: '소비 전력 설정', value: rack.powerKw + ' kW' })
    const feed = topo.infra.find((i) => i.id === rack.feed)
    if (feed) links.push({ selection: { kind: 'infra', id: feed.id }, name: feed.name, note: '전원 공급 장치' })
  } else if (infra) {
    parent = { kind: 'room', id: infra.room }; parentName = room?.name ?? infra.room
    title = infra.name; category = infra.kind === 'ups' ? '전원 장비' : '냉각 장비'
    description = infra.kind === 'ups' ? '정전 때 배터리 전력으로 장비를 보호하는 무정전 전원 공급 장치입니다. 고장이나 화재가 나면 연결된 장비의 전원 공급에 영향을 줍니다.' : '서버에서 나오는 열을 식히고 온도·습도를 조절하는 장치입니다. 냉각이 멈추면 실내 온도가 올라가 서버가 종료될 수 있습니다.'
    status = world.infra[infra.id] ? '가동 중' : '정지'; tone = world.infra[infra.id] ? 'ok' : 'danger'
    if (infra.kind === 'crac') {
      stats.push({ label: '냉각 용량 설정', value: infra.coolingKw + ' kW' }, { label: '실내 온도', value: (world.temp[infra.coolsRoom ?? infra.room] ?? 23).toFixed(1) + '°C' })
      const feed = topo.infra.find((i) => i.id === infra.feed)
      if (feed) links.push({ selection: { kind: 'infra', id: feed.id }, name: feed.name, note: '전원 공급 장치' })
    } else {
      topo.racks.filter((r) => r.feed === infra.id).forEach((r) => links.push({ selection: { kind: 'rack', id: r.id }, name: '서버 랙 ' + r.id, note: '전원 연결' }))
      topo.infra.filter((i) => i.feed === infra.id).forEach((i) => links.push({ selection: { kind: 'infra', id: i.id }, name: i.name, note: '전원 연결' }))
      stats.push({ label: '직접 연결된 장비', value: links.length + '대' })
    }
  } else if (service) {
    parent = { kind: 'rack', id: service.rack }; parentName = '서버 랙 ' + service.rack
    title = service.name; category = '서비스'
    description = (SERVICE_ROLES[service.id.replace(/-dr$/, '')] ?? '데이터센터에서 실행되는 서비스입니다.') + (service.site === 'dr' ? ' 주 전산실 장애에 대비해 DR 센터에 배치되어 있습니다.' : '')
    const state = world.services[service.id]?.state ?? 'standby'
    status = STATES[state]; tone = state === 'down' ? 'danger' : state === 'degraded' || state === 'starting' ? 'warn' : state === 'standby' ? 'muted' : 'ok'
    stats.push({ label: '운영 위치', value: site === 'main' ? '주 전산실' : 'DR 센터' }, { label: '복구 우선 등급', value: service.grade })
    const replication = topo.replication.find((r) => r.from === service.id || r.to === service.id)
    if (replication) {
      stats.push({ label: '복제 방식', value: replication.mode === 'sync' ? '동기 복제' : '비동기 복제' }, { label: '복제 지연 설정', value: replication.lagSec + '초' })
      const counterpartId = replication.from === service.id ? replication.to : replication.from
      const counterpart = topo.services.find((s) => s.id === counterpartId)
      if (counterpart) links.push({ selection: { kind: 'service', id: counterpart.id }, name: counterpart.name, note: replication.from === service.id ? '데이터 복제 대상' : '데이터 원본' })
    }
    topo.edges.filter((e) => e.from === service.id && (e.documented || world.edgesFound.some((f) => f.from === e.from && f.to === e.to))).forEach((e) => {
      const target = topo.services.find((s) => s.id === e.to)
      if (target) links.push({ selection: { kind: 'service', id: target.id }, name: target.name, note: e.kind === 'hard' ? '작동에 필요한 서비스' : '일부 기능에 필요한 서비스' })
    })
  }

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  useEffect(() => { ref.current?.querySelector('.object-body')?.scrollTo(0, 0) }, [selection.id, selection.kind])

  return <dialog ref={ref} className="details-dialog object-dialog" aria-labelledby="object-title" onCancel={() => select(null)} onClick={(e) => { if (e.target === e.currentTarget) select(null) }}>
    <div className="dialog-inner">
      <header><div><div className="section-label">{category}</div><h2 id="object-title">{title}</h2></div><button className="icon-button" aria-label="시설 설명 닫기" onClick={() => select(null)}><Icon name="close" /></button></header>
      <div className="object-body">
        {parent && <button className="object-back text-button" onClick={() => select(parent)}>← {parentName}</button>}
        <p className="object-description">{description}</p>
        <div className="object-status"><span>현재 상태</span><b className={tone}>{status}</b></div>
        {stats.length > 0 && <dl className="object-stats">{stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>}
        {links.length > 0 && <section className="object-section"><h3>{selection.kind === 'site' || selection.kind === 'room' ? '내부 구성' : '연결된 구성'}</h3><div className="object-links">{links.map((l) => <button key={l.selection.kind + l.selection.id} onClick={() => select(l.selection)}><span><b>{l.name}</b><small>{l.note}</small></span><Icon name="arrow" size={15} /></button>)}</div></section>}
        {services.length > 0 && !service && <details className="object-services" open={!!rack}><summary>서비스 {services.length}개</summary><div className="object-links">{services.map((s) => <button key={s.id} onClick={() => select({ kind: 'service', id: s.id })}><span><b>{s.name}</b></span><small className={world.services[s.id]?.state}>{STATES[world.services[s.id]?.state ?? 'standby']}</small></button>)}</div></details>}
      </div>
      <footer><button className="ghost" onClick={onMore}>전체 세부 내용<Icon name="arrow" size={15} /></button></footer>
    </div>
  </dialog>
}
