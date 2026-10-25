import type { Topology } from '../sim/model'
import type { WorldState } from '../sim/world'
import type { Phase } from '../store'

export interface SceneTransition {
  id: string
  fromLabel: string
  toLabel: string
  action: string
  state: 'live' | 'running' | 'done' | 'blocked'
  routes: { from: string; to: string }[]
}

/** Derived from the currently folded events, so seeking never reveals future recovery. */
export function sceneTransition(topo: Topology, world: WorldState, phase: Phase): SceneTransition | null {
  if (phase === 'idle' || phase === 'incident') {
    const routes = topo.replication.filter((r) => world.services[r.from]?.state === 'up')
    return routes.length ? { id: 'replication', fromLabel: '주 전산실', toLabel: 'DR 복제본', action: '데이터 복제', state: 'live', routes } : null
  }
  const steps = Object.entries(world.steps).map(([no, step]) => ({ no: Number(no), state: step.state }))
  const current = steps.find((s) => s.state === 'fail') ?? steps.find((s) => s.state === 'running') ?? steps.filter((s) => s.state === 'ok').sort((a, b) => b.no - a.no)[0]
  if (!current || current.no === 0) return null
  const state = current.state === 'fail' ? 'blocked' : current.state === 'ok' ? 'done' : 'running'
  const base = { id: 'step-' + current.no, state } as const
  switch (current.no) {
    // These paths show a change in operating location, not fresh data copied from failed servers.
    case 1: return { ...base, fromLabel: '학사 DB', toLabel: 'DR 학사 DB', action: '복제본 활성화', routes: [{ from: 'db', to: 'db-dr' }] }
    case 2: return { ...base, fromLabel: '파일저장소', toLabel: 'DR 파일저장소', action: '복제본 활성화', routes: [{ from: 'storage', to: 'storage-dr' }] }
    case 3: {
      const auth = topo.edges.find((e) => e.from === 'console-dr' && e.kind === 'hard')?.to
      if (!auth) return null
      return { ...base, fromLabel: 'DR 관리 콘솔', toLabel: auth === 'auth-dr' ? 'DR 통합인증' : '주 전산실 통합인증', action: state === 'blocked' ? '인증 연결 실패' : '인증 확인', routes: [{ from: 'console-dr', to: auth }] }
    }
    case 4: return { ...base, fromLabel: '수강신청 · 포털', toLabel: 'DR 서버', action: '운영 전환', routes: [{ from: 'sugang', to: 'sugang-dr' }, { from: 'portal', to: 'portal-dr' }] }
    case 5: return { ...base, fromLabel: '주 전산실 DNS', toLabel: 'DR DNS', action: '접속 경로 전환', routes: [{ from: 'dns', to: 'dns-dr' }] }
    default: return { ...base, fromLabel: 'DR DNS', toLabel: 'DR 서비스', action: state === 'done' ? '접속 전환 완료' : '접속 확인', routes: [{ from: 'dns-dr', to: 'sugang-dr' }] }
  }
}
