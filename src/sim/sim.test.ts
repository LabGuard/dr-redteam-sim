import { describe, expect, it } from 'vitest'
import { applyFixes, baseTopology } from './model'
import { simulateIncident } from './incident'
import { runRehearsal } from './rehearsal'
import { analyze } from './analysis'
import { recommend } from './budget'

const human = { 0: 15, 6: 30 }

describe('사고 엔진', () => {
  it('화재 → 냉각 상실 → 온도 상승 → 선제 셧다운으로 주 전산실 서비스가 모두 멈춘다', () => {
    const r = simulateIncident(baseTopology, 'fire', { shutdownAtC: 35 })
    const temps = r.events.filter((e) => e.type === 'temp').map((e) => (e as { value: number }).value)
    expect(Math.max(...temps)).toBeGreaterThanOrEqual(35)
    expect(r.events.some((e) => e.type === 'policy')).toBe(true)
    expect(Object.entries(r.racks).filter(([id]) => id.startsWith('R')).every(([, s]) => s === 'off')).toBe(true)
  })

  it('임계 온도를 올리면 셧다운이 늦어진다', () => {
    const at = (c: number) => simulateIncident(baseTopology, 'fire', { shutdownAtC: c }).events.find((e) => e.type === 'policy')!.t
    expect(at(40)).toBeGreaterThan(at(35))
  })
})

describe('리허설 실행기', () => {
  it('원본 절차서는 3단계에서 실패하고, 문서에 없던 관리 콘솔 → 통합인증 의존을 발견한다', () => {
    const r = runRehearsal({ topo: baseTopology, fixes: [], humanMin: human, run: 1 })
    expect(r.blocked).toBe(true)
    expect(r.failedStep).toBe(3)
    expect(r.discovered).toEqual([{ from: 'console-dr', to: 'auth', via: 'SSO 로그인' }])
    expect(r.lost).toBeGreaterThan(0)
  })

  it('숨은 의존을 계획서에 반영해도(이중화 없이) 인증이 없으니 여전히 막힌다', () => {
    const topo = structuredClone(baseTopology)
    topo.edges = topo.edges.map((e) => ({ ...e, documented: true }))
    const r = runRehearsal({ topo, fixes: [], humanMin: human, run: 1 })
    expect(r.blocked).toBe(true)
    expect(r.discovered).toEqual([])
  })

  it('인증 이중화 후 전환에 성공하고 사람 시간이 늘면 A1을 넘길 수 있다', () => {
    const fixes = ['auth-dual']
    const ok = runRehearsal({ topo: applyFixes(baseTopology, fixes), fixes, humanMin: human, run: 2 })
    expect(ok.blocked).toBe(false)
    expect(ok.pass).toBe(true)
    expect(ok.degraded).toContain('sugang-dr')
    const slow = runRehearsal({ topo: applyFixes(baseTopology, fixes), fixes, humanMin: { 0: 40, 6: 30 }, run: 2 })
    expect(slow.pass).toBe(false)
  })

  it('동기 복제를 넣으면 유실 0건', () => {
    const fixes = ['auth-dual', 'db-sync']
    expect(runRehearsal({ topo: applyFixes(baseTopology, fixes), fixes, humanMin: human, run: 2 }).lost).toBe(0)
  })
})

describe('정적 분석과 예산', () => {
  it('정적 분석은 관제 공통원인·등급 역전을 찾지만 인증은 낮음으로 본다', () => {
    const f = analyze(baseTopology)
    expect(f.find((x) => x.id === 'cc-monitor')?.severity).toBe('medium')
    expect(f.find((x) => x.id === 'cc-auth')?.severity).toBe('low')
    expect(f.some((x) => x.kind === '등급 역전')).toBe(true)
  })

  it('예산 5억이면 인증 이중화가 1순위', () => {
    const r = recommend(baseTopology, 5, human)
    expect(r.picks[0].id).toBe('auth-dual')
    expect(r.spent).toBeLessThanOrEqual(5)
    expect(r.result.pass).toBe(true)
  })
})
