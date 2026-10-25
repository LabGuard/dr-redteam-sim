import type { Topology } from './model'
import type { ServiceState } from './events'

// 랙 전원 상태와 서비스 자체 상태로부터, hard 의존을 따라 실제로 쓸 수 있는 서비스를 계산한다.
// edges는 호출자가 고른다: 계획서 기준(documented만) 또는 실제 환경(전부).
export function resolveAvailability(
  topo: Topology,
  own: Record<string, ServiceState>,
  edges = topo.edges,
): Record<string, { state: ServiceState; reason?: string }> {
  const out: Record<string, { state: ServiceState; reason?: string }> = {}
  const visiting = new Set<string>()
  const byId = new Map(topo.services.map((s) => [s.id, s]))

  const visit = (id: string): ServiceState => {
    if (out[id]) return out[id].state
    const self = own[id] ?? 'down'
    if (self !== 'up' || visiting.has(id)) {
      out[id] = { state: self }
      return self
    }
    visiting.add(id)
    let state: ServiceState = 'up'
    let reason: string | undefined
    for (const e of edges) {
      if (e.from !== id) continue
      const dep = visit(e.to)
      if (dep === 'up') continue
      const name = byId.get(e.to)?.name ?? e.to
      if (e.kind === 'hard') {
        state = 'down'
        reason = `의존 장애: ${name}`
        break
      }
      state = 'degraded'
      reason = `기능 저하: ${name}`
    }
    visiting.delete(id)
    out[id] = { state, reason }
    return state
  }

  for (const s of topo.services) visit(s.id)
  return out
}
