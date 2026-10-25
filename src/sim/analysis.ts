import { procedure, type Topology } from './model'

export interface Finding {
  id: string
  kind: '공통원인' | '등급 역전' | '복제 지연'
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  subject: string // 관련 서비스 id
}

// 문서(계획서·CMDB)에 있는 정보만으로 찾을 수 있는 것. 문서에 없는 의존은 여기서 못 찾는다.
export function analyze(topo: Topology): Finding[] {
  const out: Finding[] = []
  const svc = new Map(topo.services.map((s) => [s.id, s]))
  const hasDr = (id: string) => topo.services.some((s) => s.site === 'dr' && (s.id === `${id}-dr`))
  const documented = topo.edges.filter((e) => e.documented)
  const drIds = new Set(topo.services.filter((s) => s.site === 'dr').map((s) => s.id))

  for (const s of topo.services) {
    if (s.site !== 'main' || s.grade === 'A3' || hasDr(s.id)) continue
    const drDependents = documented.filter((e) => e.to === s.id && drIds.has(e.from))
    const usedByProcedure = s.id === 'monitor' && procedure.some((p) => p.action === 'verify')
    const severity = drDependents.length ? 'high' : usedByProcedure ? 'medium' : 'low'
    out.push({
      id: `cc-${s.id}`,
      kind: '공통원인',
      severity,
      subject: s.id,
      title: `${s.name}(${s.grade})가 주 사이트에만 있음`,
      detail: drDependents.length
        ? `DR 서비스 ${drDependents.length}개가 문서상 의존`
        : usedByProcedure
          ? '절차서 6단계 정상 확인이 수동 점검으로 바뀜'
          : '문서상 DR 경로에서 쓰는 곳 없음 → 낮음',
    })
  }

  for (const e of documented) {
    const a = svc.get(e.from)
    const b = svc.get(e.to)
    if (!a || !b || a.site !== 'dr') continue
    if (b.site === 'main' && Number(b.grade[1]) > Number(a.grade[1])) {
      out.push({
        id: `inv-${e.from}-${e.to}`,
        kind: '등급 역전',
        severity: e.kind === 'hard' ? 'high' : 'medium',
        subject: b.id,
        title: `${a.name}(${a.grade}) → ${b.name}(${b.grade}, DR 없음)`,
        detail: e.kind === 'hard' ? '전환해도 기동 불가' : '전환 후 기능 저하',
      })
    }
  }

  for (const r of topo.replication) {
    if (r.mode !== 'async') continue
    const s = svc.get(r.from)!
    if (s.grade !== 'A1') continue
    out.push({
      id: `rep-${r.from}`,
      kind: '복제 지연',
      severity: 'medium',
      subject: r.from,
      title: `${s.name} 비동기 복제 (지연 ${r.lagSec}초)`,
      detail: '전환 시 최근 쓰기 유실 가능 (RPO > 0)',
    })
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}
