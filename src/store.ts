import { create } from 'zustand'
import { useMemo } from 'react'
import { applyFixes, baseTopology, type Topology } from './sim/model'
import { simulateIncident, type IncidentResult, type ScenarioId } from './sim/incident'
import { runRehearsal, type RehearsalResult } from './sim/rehearsal'
import { recommend } from './sim/budget'
import type { SimEvent } from './sim/events'
import { applyEvents, initialWorld, type WorldState } from './sim/world'
import { resolveAvailability } from './sim/graph'

export type Phase = 'idle' | 'incident' | 'rehearsal' | 'fix' | 'rerun' | 'report'
export type SceneSelection = { kind: 'site' | 'room' | 'rack' | 'infra' | 'service'; id: string }

interface Store {
  phase: Phase
  scenario: ScenarioId
  shutdownAtC: number
  humanMin: Record<number, number>
  budget: number
  fixes: string[]
  draftFixes: string[]
  topo: Topology
  incident: IncidentResult | null
  runs: RehearsalResult[]
  runFixes: string[][]
  showServices: boolean
  selection: SceneSelection | null
  selectObject: (selection: SceneSelection | null) => void
  hovered: SceneSelection | null
  hoverObject: (selection: SceneSelection | null) => void
  cameraRevision: number
  setShowServices: (show: boolean) => void
  resetCamera: () => void
  baseEvents: SimEvent[]
  events: SimEvent[]
  duration: number
  t: number
  playing: boolean
  speed: number
  mult: number

  setScenario: (s: ScenarioId) => void
  setShutdown: (c: number) => void
  setHuman: (no: number, min: number) => void
  setBudget: (b: number) => void
  toggleDraft: (id: string) => void
  startIncident: () => void
  startRehearsal: () => void
  openFix: () => void
  applyAndRerun: () => void
  openReport: () => void
  closeReport: () => void
  reset: () => void
  setPlaying: (p: boolean) => void
  setMult: (m: number) => void
  seek: (t: number) => void
  advance: (dt: number) => void
}

const SPEED = { incident: 14, rehearsal: 3.2, rerun: 5 }

export const useStore = create<Store>((set, get) => ({
  phase: 'idle',
  scenario: 'fire',
  shutdownAtC: 35,
  humanMin: { 0: 15, 6: 30 },
  budget: 5,
  fixes: [],
  draftFixes: [],
  topo: baseTopology,
  incident: null,
  runs: [],
  runFixes: [],
  showServices: false,
  selection: null,
  selectObject: (selection) => set({ selection, hovered: null }),
  hovered: null,
  hoverObject: (hovered) => set({ hovered }),
  cameraRevision: 0,
  setShowServices: (showServices) => set({ showServices, hovered: null }),
  resetCamera: () => set((s) => ({ cameraRevision: s.cameraRevision + 1, hovered: null })),
  baseEvents: [],
  events: [],
  duration: 0,
  t: 0,
  playing: false,
  speed: 1,
  mult: 1,

  setScenario: (scenario) => set({ scenario }),
  setShutdown: (shutdownAtC) => set({ shutdownAtC }),
  setHuman: (no, min) => set((s) => ({ humanMin: { ...s.humanMin, [no]: min } })),
  setBudget: (budget) => {
    const rec = recommend(baseTopology, budget, get().humanMin)
    set({ budget, draftFixes: rec.picks.map((p) => p.id) })
  },
  toggleDraft: (id) =>
    set((s) => ({ draftFixes: s.draftFixes.includes(id) ? s.draftFixes.filter((x) => x !== id) : [...s.draftFixes, id] })),

  startIncident: () => {
    const { scenario, shutdownAtC } = get()
    const incident = simulateIncident(baseTopology, scenario, { shutdownAtC })
    set({
      phase: 'incident', incident, topo: baseTopology, fixes: [], runs: [], runFixes: [], baseEvents: [],
      events: incident.events, duration: incident.duration, t: 0, playing: true, speed: SPEED.incident,
    })
  },
  startRehearsal: () => {
    const { incident, humanMin } = get()
    if (!incident) return
    const r = runRehearsal({ topo: baseTopology, fixes: [], humanMin, run: 1 })
    set({
      phase: 'rehearsal', runs: [r], runFixes: [[]], topo: baseTopology, fixes: [], baseEvents: incident.events,
      events: r.events, duration: r.duration, t: 0, playing: true, speed: SPEED.rehearsal,
    })
  },
  openFix: () => {
    const { budget, humanMin } = get()
    const rec = recommend(baseTopology, budget, humanMin)
    set({ phase: 'fix', draftFixes: rec.picks.map((p) => p.id), playing: false })
  },
  applyAndRerun: () => {
    const { draftFixes, humanMin, runs, runFixes, incident } = get()
    if (!incident) return
    const topo = applyFixes(baseTopology, draftFixes)
    const r = runRehearsal({ topo, fixes: draftFixes, humanMin, run: runs.length + 1 })
    set({
      phase: 'rerun', fixes: [...draftFixes], topo, runs: [...runs, r], runFixes: [...runFixes, [...draftFixes]], baseEvents: incident.events,
      events: r.events, duration: r.duration, t: 0, playing: true, speed: SPEED.rerun,
    })
  },
  openReport: () => set({ phase: 'report', playing: false }),
  closeReport: () => set({ phase: 'rerun' }),
  reset: () => set({ phase: 'idle', incident: null, runs: [], runFixes: [], fixes: [], draftFixes: [], selection: null, hovered: null, showServices: false, topo: baseTopology, baseEvents: [], events: [], duration: 0, t: 0, playing: false }),
  setPlaying: (playing) => {
    const { t, duration } = get()
    if (playing && t >= duration) set({ t: 0 })
    set({ playing })
  },
  setMult: (mult) => set({ mult }),
  seek: (t) => set({ t: Math.max(0, Math.min(get().duration, t)) }),
  advance: (dt) => {
    const { playing, t, duration, speed, mult } = get()
    if (!playing) return
    const nt = t + dt * speed * mult
    if (nt >= duration) set({ t: duration, playing: false })
    else set({ t: nt })
  },
}))

const baseCache = new WeakMap<SimEvent[], Map<Topology, WorldState>>()

function baseWorld(topo: Topology, base: SimEvent[]) {
  let m = baseCache.get(base)
  if (!m) baseCache.set(base, (m = new Map()))
  let w = m.get(topo)
  if (!w) {
    w = applyEvents(initialWorld(topo), base, Infinity, { logs: false })
    if (base.length) {
      // 사고의 물리 상태는 유지하고, 개선된 DR 구성의 가용성을 다시 표시한다.
      const initial = initialWorld(topo)
      const own = Object.fromEntries(topo.services.map((svc) => [svc.id, svc.site === 'dr' ? initial.services[svc.id].state : w!.services[svc.id].state]))
      w.services = resolveAvailability(topo, own)
    }
    w.shot = 'overview'
    w.banner = null
    w.ended = false
    m.set(topo, w)
  }
  return w
}

export function computeWorld(s: Pick<Store, 'topo' | 'baseEvents' | 'events' | 't' | 'runs' | 'phase'>): WorldState {
  const w = structuredClone(baseWorld(s.topo, s.baseEvents))
  applyEvents(w, s.events, s.t)
  // 지난 회차에서 발견한 의존은 그래프에 남는다(대책으로 사라진 에지는 제외)
  if (s.phase === 'fix' || s.phase === 'rerun' || s.phase === 'report') {
    for (const r of s.runs.slice(0, -1).concat(s.phase === 'fix' ? s.runs.slice(-1) : [])) {
      for (const d of r.discovered) {
        const still = s.topo.edges.some((e) => e.from === d.from && e.to === d.to)
        if (still && !w.edgesFound.some((x) => x.from === d.from && x.to === d.to)) w.edgesFound.push({ ...d, at: -1 })
      }
    }
  }
  return w
}

// 화면(3D·HUD)이 같은 프레임에 같은 상태를 보도록 한 번만 계산한다.
let last: { key: unknown[]; w: WorldState } | null = null
function cachedWorld(key: [Topology, SimEvent[], SimEvent[], number, RehearsalResult[], Phase]) {
  if (last && last.key.every((k, i) => k === key[i])) return last.w
  const [topo, baseEvents, events, t, runs, phase] = key
  last = { key, w: computeWorld({ topo, baseEvents, events, t, runs, phase }) }
  return last.w
}

export function useWorld() {
  const topo = useStore((s) => s.topo)
  const baseEvents = useStore((s) => s.baseEvents)
  const events = useStore((s) => s.events)
  const t = useStore((s) => s.t)
  const runs = useStore((s) => s.runs)
  const phase = useStore((s) => s.phase)
  return useMemo(() => cachedWorld([topo, baseEvents, events, t, runs, phase]), [topo, baseEvents, events, t, runs, phase])
}

// 개발 중 점검용
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __dr: typeof useStore }).__dr = useStore
