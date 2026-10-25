import { A1_RTO_MIN, applyFixes, countermeasures, type Topology } from './model'
import { runRehearsal, type RehearsalResult } from './rehearsal'

// 대책 조합마다 리허설을 다시 돌려 점수를 매기고, 예산 안에서 효과/비용이 큰 것부터 고른다(탐욕법).
function score(r: RehearsalResult) {
  if (r.blocked) return 0
  return 1000 + Math.max(0, A1_RTO_MIN - r.totalMin!) * 5 + (r.lost === 0 ? 50 : 0) + (r.degraded.length === 0 ? 45 : 0)
}

export interface Pick {
  id: string
  gain: string
  costEok: number
}

export function recommend(base: Topology, budgetEok: number, humanMin: Record<number, number>) {
  const evalSet = (fixes: string[]) => runRehearsal({ topo: applyFixes(base, fixes), fixes, humanMin, run: 0 })
  const chosen: string[] = []
  const picks: Pick[] = []
  let current = evalSet([])
  let left = budgetEok

  for (;;) {
    let best: { id: string; ratio: number; res: RehearsalResult } | null = null
    for (const c of countermeasures) {
      if (chosen.includes(c.id) || c.costEok > left + 1e-9) continue
      const res = evalSet([...chosen, c.id])
      const gain = score(res) - score(current)
      if (gain <= 0) continue
      const ratio = gain / c.costEok
      if (!best || ratio > best.ratio) best = { id: c.id, ratio, res }
    }
    if (!best) break
    const c = countermeasures.find((x) => x.id === best!.id)!
    picks.push({ id: c.id, costEok: c.costEok, gain: describeGain(current, best.res) })
    chosen.push(c.id)
    left -= c.costEok
    current = best.res
  }
  const skipped = countermeasures.filter((c) => !chosen.includes(c.id)).map((c) => ({ id: c.id, reason: c.costEok > left ? '예산 초과' : '효과 없음' }))
  return { picks, skipped, result: current, spent: budgetEok - left }
}

function describeGain(a: RehearsalResult, b: RehearsalResult) {
  if (a.blocked && !b.blocked) return `전환 가능 (${b.totalMin}분)`
  const parts: string[] = []
  if (a.totalMin !== null && b.totalMin !== null && b.totalMin < a.totalMin) parts.push(`−${a.totalMin - b.totalMin}분`)
  if (b.lost < a.lost) parts.push(`유실 ${a.lost}→${b.lost}건`)
  if (b.degraded.length < a.degraded.length) parts.push('기능 저하 해소')
  return parts.join(' · ') || '개선'
}
