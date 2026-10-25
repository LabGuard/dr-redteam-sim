// 가상 대전 ○○대학 정보화본부 — 모든 값은 시연용 가상 데이터.

export type SiteId = 'main' | 'dr'
export type Grade = 'A1' | 'A2' | 'A3'

export interface Room {
  id: string
  site: SiteId
  name: string
  kind: 'server' | 'battery'
  rect: [number, number, number, number] // x0, z0, x1, z1 (월드 좌표)
}

export interface Rack {
  id: string
  site: SiteId
  room: string
  pos: [number, number] // x, z
  powerKw: number
  feed: string // 전원 공급 장치 id
}

export interface Infra {
  id: string
  name: string
  kind: 'ups' | 'crac'
  room: string
  pos: [number, number]
  feed?: string
  coolingKw?: number
  coolsRoom?: string
}

export interface Service {
  id: string
  name: string
  grade: Grade
  site: SiteId
  rack: string
  role: 'primary' | 'replica' | 'standby'
  hot?: boolean // 대기 중에도 켜져 응답하는 구성요소
  userFacing?: boolean
}

export interface Edge {
  from: string
  to: string
  kind: 'hard' | 'soft'
  // 문서(계획서·CMDB)에 있는 의존인지. false면 실제 환경에만 존재.
  documented: boolean
  via?: string // 예: 'SSO 로그인'
}

export interface Topology {
  rooms: Room[]
  racks: Rack[]
  infra: Infra[]
  services: Service[]
  edges: Edge[]
  replication: { from: string; to: string; mode: 'async' | 'sync'; lagSec: number }[]
}

export const SITE_LABEL: Record<SiteId, string> = { main: '주 전산실 (본관)', dr: 'DR 센터 (제2캠퍼스)' }

export const baseTopology: Topology = {
  rooms: [
    { id: 'battery', site: 'main', name: '배터리실 (UPS)', kind: 'battery', rect: [-13.4, -3.6, -9.6, 3.6] },
    { id: 'server-a', site: 'main', name: '서버실 A', kind: 'server', rect: [-9.4, -3.6, -1.0, 3.6] },
    { id: 'dr-server', site: 'dr', name: 'DR 서버실', kind: 'server', rect: [3.0, -2.8, 10.2, 2.8] },
  ],
  infra: [
    { id: 'ups-a', name: 'UPS-A · 리튬 배터리', kind: 'ups', room: 'battery', pos: [-11.5, -1.2] },
    { id: 'ups-a2', name: 'UPS-A · 배터리 랙 2', kind: 'ups', room: 'battery', pos: [-11.5, 1.4] },
    { id: 'crac-1', name: '항온항습기 1', kind: 'crac', room: 'server-a', pos: [-8.6, -2.6], feed: 'ups-a', coolingKw: 40, coolsRoom: 'server-a' },
    { id: 'crac-2', name: '항온항습기 2', kind: 'crac', room: 'server-a', pos: [-8.6, 2.6], feed: 'ups-a', coolingKw: 40, coolsRoom: 'server-a' },
    { id: 'ups-d', name: 'UPS-D', kind: 'ups', room: 'dr-server', pos: [9.4, -2.0] },
    { id: 'crac-d', name: '항온항습기 D', kind: 'crac', room: 'dr-server', pos: [9.4, 2.0], feed: 'ups-d', coolingKw: 30, coolsRoom: 'dr-server' },
  ],
  racks: [
    { id: 'R01', site: 'main', room: 'server-a', pos: [-6.4, -1.6], powerKw: 11, feed: 'ups-a' },
    { id: 'R02', site: 'main', room: 'server-a', pos: [-4.6, -1.6], powerKw: 12, feed: 'ups-a' },
    { id: 'R03', site: 'main', room: 'server-a', pos: [-2.8, -1.6], powerKw: 9, feed: 'ups-a' },
    { id: 'R04', site: 'main', room: 'server-a', pos: [-6.4, 1.6], powerKw: 10, feed: 'ups-a' },
    { id: 'R05', site: 'main', room: 'server-a', pos: [-4.6, 1.6], powerKw: 9, feed: 'ups-a' },
    { id: 'R06', site: 'main', room: 'server-a', pos: [-2.8, 1.6], powerKw: 8, feed: 'ups-a' },
    { id: 'D01', site: 'dr', room: 'dr-server', pos: [4.6, -1.2], powerKw: 6, feed: 'ups-d' },
    { id: 'D02', site: 'dr', room: 'dr-server', pos: [6.4, -1.2], powerKw: 6, feed: 'ups-d' },
    { id: 'D03', site: 'dr', room: 'dr-server', pos: [5.5, 1.4], powerKw: 5, feed: 'ups-d' },
  ],
  services: [
    { id: 'auth', name: '통합인증', grade: 'A1', site: 'main', rack: 'R01', role: 'primary' },
    { id: 'dns', name: 'DNS', grade: 'A1', site: 'main', rack: 'R01', role: 'primary' },
    { id: 'db', name: '학사 DB', grade: 'A1', site: 'main', rack: 'R02', role: 'primary' },
    { id: 'monitor', name: '관제', grade: 'A2', site: 'main', rack: 'R02', role: 'primary' },
    { id: 'storage', name: '파일저장소', grade: 'A2', site: 'main', rack: 'R03', role: 'primary' },
    { id: 'sugang', name: '수강신청', grade: 'A1', site: 'main', rack: 'R04', role: 'primary', userFacing: true },
    { id: 'portal', name: '포털', grade: 'A2', site: 'main', rack: 'R05', role: 'primary', userFacing: true },
    { id: 'haksa', name: '학사정보 API', grade: 'A3', site: 'main', rack: 'R06', role: 'primary' },
    { id: 'lms', name: 'e-러닝', grade: 'A3', site: 'main', rack: 'R06', role: 'primary', userFacing: true },

    { id: 'dns-dr', name: 'DNS 보조', grade: 'A1', site: 'dr', rack: 'D01', role: 'standby', hot: true },
    { id: 'db-dr', name: '학사 DB 복제본', grade: 'A1', site: 'dr', rack: 'D01', role: 'replica' },
    { id: 'storage-dr', name: '파일저장소 복제본', grade: 'A2', site: 'dr', rack: 'D02', role: 'replica' },
    { id: 'console-dr', name: 'DR 관리 콘솔', grade: 'A1', site: 'dr', rack: 'D02', role: 'standby', hot: true },
    { id: 'sugang-dr', name: '수강신청 대기', grade: 'A1', site: 'dr', rack: 'D03', role: 'standby', userFacing: true },
    { id: 'portal-dr', name: '포털 대기', grade: 'A2', site: 'dr', rack: 'D03', role: 'standby', userFacing: true },
  ],
  edges: [
    { from: 'portal', to: 'auth', kind: 'hard', documented: true },
    { from: 'portal', to: 'db', kind: 'hard', documented: true },
    { from: 'portal', to: 'dns', kind: 'hard', documented: true },
    { from: 'sugang', to: 'auth', kind: 'hard', documented: true },
    { from: 'sugang', to: 'db', kind: 'hard', documented: true },
    { from: 'sugang', to: 'haksa', kind: 'soft', documented: true },
    { from: 'lms', to: 'auth', kind: 'hard', documented: true },
    { from: 'lms', to: 'storage', kind: 'hard', documented: true },
    { from: 'monitor', to: 'dns', kind: 'soft', documented: true },

    { from: 'portal-dr', to: 'db-dr', kind: 'hard', documented: true },
    { from: 'portal-dr', to: 'dns-dr', kind: 'hard', documented: true },
    { from: 'sugang-dr', to: 'db-dr', kind: 'hard', documented: true },
    { from: 'sugang-dr', to: 'dns-dr', kind: 'hard', documented: true },
    { from: 'sugang-dr', to: 'haksa', kind: 'soft', documented: true },

    // 계획서·CMDB에 없는 실제 의존: DR 관리 콘솔의 SSO 로그인이 주 사이트 통합인증을 탄다.
    { from: 'console-dr', to: 'auth', kind: 'hard', documented: false, via: 'SSO 로그인' },
  ],
  replication: [
    { from: 'db', to: 'db-dr', mode: 'async', lagSec: 7 },
    { from: 'storage', to: 'storage-dr', mode: 'async', lagSec: 30 },
  ],
}

export interface ProcedureStep {
  no: number
  name: string
  mode: 'auto' | 'human'
  estMin: number // 사람 단계 추정(분). 자동 단계는 실측.
  action?: 'promote' | 'login' | 'start' | 'dns' | 'verify'
  targets?: string[]
}

// 기관이 가진 DR 전환 절차서(가상). 계획서상 목표 시간 합계 = 55분.
export const procedure: ProcedureStep[] = [
  { no: 0, name: '전환 결정 · 비상 소집', mode: 'human', estMin: 15 },
  { no: 1, name: 'DR 학사 DB 승격', mode: 'auto', estMin: 0, action: 'promote', targets: ['db-dr'] },
  { no: 2, name: '파일저장소 DR 전환', mode: 'auto', estMin: 0, action: 'promote', targets: ['storage-dr'] },
  { no: 3, name: 'DR 관리 콘솔 로그인', mode: 'auto', estMin: 0, action: 'login', targets: ['console-dr'] },
  { no: 4, name: '수강신청 · 포털 DR 기동', mode: 'auto', estMin: 0, action: 'start', targets: ['sugang-dr', 'portal-dr'] },
  { no: 5, name: 'DNS를 DR로 전환', mode: 'auto', estMin: 0, action: 'dns', targets: ['dns-dr'] },
  { no: 6, name: '서비스 정상 확인', mode: 'human', estMin: 30, action: 'verify' },
]

export interface Countermeasure {
  id: string
  name: string
  costEok: number // 억 원
  desc: string
}

export const countermeasures: Countermeasure[] = [
  { id: 'auth-dual', name: '통합인증 DR 이중화', costEok: 2.0, desc: 'DR 센터에 인증 서버를 두고 관리 콘솔·서비스 SSO를 DR 인증으로 돌린다' },
  { id: 'monitor-dr', name: '관제 DR 구축', costEok: 1.5, desc: 'DR 센터에 관제를 두어 정상 확인을 자동화한다 (사람 단계 −10분)' },
  { id: 'db-sync', name: '학사 DB 동기 복제', costEok: 3.0, desc: '비동기 → 동기 복제로 바꿔 전환 시 유실을 0건으로 만든다' },
  { id: 'haksa-dr', name: '학사정보 API DR 배치', costEok: 1.2, desc: 'A1 수강신청이 기대는 A3 서비스를 DR에도 둔다 (등급 역전 해소)' },
]

export const A1_RTO_MIN = 60

// 대책을 적용한 토폴로지를 만든다.
export function applyFixes(base: Topology, fixes: string[]): Topology {
  const t: Topology = structuredClone(base)
  if (fixes.includes('auth-dual')) {
    t.services.push({ id: 'auth-dr', name: '통합인증 DR', grade: 'A1', site: 'dr', rack: 'D01', role: 'standby', hot: true })
    t.edges = t.edges.map((e) => (e.from === 'console-dr' && e.to === 'auth' ? { ...e, to: 'auth-dr', documented: true } : e))
    t.edges.push({ from: 'sugang-dr', to: 'auth-dr', kind: 'hard', documented: true })
    t.edges.push({ from: 'portal-dr', to: 'auth-dr', kind: 'hard', documented: true })
  }
  if (fixes.includes('monitor-dr')) {
    t.services.push({ id: 'monitor-dr', name: '관제 DR', grade: 'A2', site: 'dr', rack: 'D02', role: 'standby', hot: true })
  }
  if (fixes.includes('db-sync')) {
    t.replication = t.replication.map((r) => (r.to === 'db-dr' ? { ...r, mode: 'sync', lagSec: 0 } : r))
  }
  if (fixes.includes('haksa-dr')) {
    t.services.push({ id: 'haksa-dr', name: '학사정보 API DR', grade: 'A3', site: 'dr', rack: 'D03', role: 'standby', hot: true })
    t.edges = t.edges.map((e) => (e.from === 'sugang-dr' && e.to === 'haksa' ? { ...e, to: 'haksa-dr' } : e))
  }
  return t
}
