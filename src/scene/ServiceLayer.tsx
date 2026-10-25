import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'
import type { Service, Topology } from '../sim/model'
import type { ServiceState } from '../sim/events'
import type { WorldState } from '../sim/world'
import { C, RACK, servicePositions } from './layout'
import { useStore } from '../store'
import { Selectable } from './Selectable'

const STATE_COLOR: Record<ServiceState, string> = {
  up: C.cyan,
  standby: '#4c5d78',
  starting: C.amber,
  degraded: C.amber,
  down: '#b3263a',
}

const ServiceNode = memo(function ServiceNode({
  svc, state, pos, rackPos, alarm,
}: { svc: Service; state: ServiceState; pos: THREE.Vector3; rackPos: [number, number]; alarm: boolean }) {
  const core = useRef<THREE.MeshStandardMaterial>(null)
  const hovered = useStore((s) => s.hovered?.kind === 'service' && s.hovered.id === svc.id)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const alarmRing = useRef<THREE.Mesh>(null)
  const changed = useRef({ at: -10, prev: state })
  const color = useMemo(() => new THREE.Color(STATE_COLOR[state]), [state])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (changed.current.prev !== state) changed.current = { at: now, prev: state }
    const since = now - changed.current.at
    const pulse = state === 'starting' ? 0.5 + 0.5 * Math.sin(now * 8) : 1
    const flash = since < 0.8 ? 1 + (1 - since / 0.8) * 3 : 1
    if (core.current) {
      core.current.emissive.copy(color)
      core.current.emissiveIntensity = (state === 'standby' ? 0.35 : state === 'down' ? 0.6 : 1.6) * pulse * flash
    }
    if (ring.current && ringMat.current) {
      ring.current.rotation.z += 0.01
      const s = since < 0.8 ? 1 + (since / 0.8) * 0.8 : 1
      ring.current.scale.setScalar(s)
      ringMat.current.color.copy(color)
      ringMat.current.opacity = since < 0.8 ? 1 - since / 0.8 + 0.3 : state === 'standby' ? 0.15 : 0.35
    }
    if (alarmRing.current) {
      const k = (now * 1.4) % 1
      alarmRing.current.scale.setScalar(1 + k * 2.2)
      ;(alarmRing.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9
    }
  })

  return (
    <group>
      <Line
        points={[[rackPos[0], RACK.h + 0.02, rackPos[1]], [pos.x, pos.y - 0.1, pos.z]]}
        color={STATE_COLOR[state]}
        lineWidth={1}
        transparent
        opacity={state === 'up' ? 0.55 : 0.18}
        dashed={state !== 'up'}
        dashSize={0.12}
        gapSize={0.1}
      />
      <Selectable selection={{ kind: 'service', id: svc.id }}><group position={pos}>
        <mesh>
          <cylinderGeometry args={[0.32, 0.32, 0.14, 6]} />
          <meshStandardMaterial ref={core} color="#0a0f18" emissive={STATE_COLOR[state]} toneMapped={false} metalness={0.2} roughness={0.4} />
        </mesh>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.47, 6]} />
          <meshBasicMaterial ref={ringMat} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {alarm && (
          <mesh ref={alarmRing} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.55, 48]} />
            <meshBasicMaterial color={C.red} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
        {alarm && !hovered && <Html position={[0, 0.65, 0]} center pointerEvents="none" zIndexRange={[20, 10]}>
          <div className={`svc-label ${state}${alarm ? ' alarm' : ''}`}>
            <span>{svc.name}</span>
          </div>
        </Html>}
      </group></Selectable>
    </group>
  )
})

function FlowEdge({
  from, to, color, width, opacity, flow, height, dashed = true, drawIn = false, label,
}: {
  from: THREE.Vector3; to: THREE.Vector3; color: string; width: number; opacity: number; flow: number; height: number
  dashed?: boolean; drawIn?: boolean; label?: React.ReactNode
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)
  const born = useRef<number | null>(null)
  const mid = useMemo(() => {
    const m = from.clone().lerp(to, 0.5)
    m.y += height + from.distanceTo(to) * 0.12
    return m
  }, [from, to, height])
  const end = useMemo(() => new THREE.Vector3(), [])
  const mid2 = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const line = ref.current
    if (!line) return
    if (line.material) {
      const store = useStore.getState()
      line.material.dashOffset = -(store.phase === 'idle' ? clock.elapsedTime : store.t * 0.35) * flow
    }
    if (drawIn) {
      if (born.current === null) born.current = clock.elapsedTime
      const k = Math.min(1, (clock.elapsedTime - born.current) / 1.1)
      const e = 1 - Math.pow(1 - k, 3)
      // 베지어를 따라 끝점을 늘린다
      end.copy(from).multiplyScalar((1 - e) * (1 - e)).addScaledVector(mid, 2 * (1 - e) * e).addScaledVector(to, e * e)
      mid2.copy(from).lerp(mid, e)
      line.setPoints(from, end, mid2)
    }
  })

  return (
    <>
      <QuadraticBezierLine
        ref={ref}
        start={from}
        end={drawIn ? from : to}
        mid={drawIn ? from : mid}
        color={color}
        lineWidth={width}
        transparent
        opacity={opacity}
        dashed={dashed}
        dashSize={0.35}
        gapSize={0.22}
        toneMapped={false}
      />
      {label && (
        <Html position={mid.clone().setY(mid.y * 0.5 + Math.max(from.y, to.y) * 0.5)} center pointerEvents="none" zIndexRange={[40, 30]}>
          {label}
        </Html>
      )}
    </>
  )
}

export function ServiceLayer({ topo, world }: { topo: Topology; world: WorldState }) {
  const showAll = useStore((s) => s.showServices)
  const pos = useMemo(() => servicePositions(topo), [topo])
  const rackPos = useMemo(() => Object.fromEntries(topo.racks.map((r) => [r.id, r.pos])), [topo])
  const st = (id: string) => world.services[id]?.state ?? 'standby'
  const found = world.edgesFound
  const alarmIds = new Set(found.flatMap((e) => [e.from, e.to]))

  return (
    <group>
      {topo.services.filter(() => showAll).map((s) => (
        <ServiceNode key={s.id} svc={s} state={st(s.id)} pos={pos[s.id]} rackPos={rackPos[s.rack]} alarm={alarmIds.has(s.id)} />
      ))}

      {topo.edges.map((e) => {
        if (!pos[e.from] || !pos[e.to]) return null
        const isFound = found.some((f) => f.from === e.from && f.to === e.to)
        if (!e.documented && !isFound) return null
        if (!showAll) return null
        const key = `${e.from}>${e.to}`
        if (isFound) {
          const f = found.find((x) => x.from === e.from && x.to === e.to)!
          return (
            <FlowEdge
              key={key + '-found'}
              from={pos[e.from]}
              to={pos[e.to]}
              color={C.red}
              width={4}
              opacity={1}
              flow={0}
              height={2.4}
              drawIn={f.at >= 0}
            />
          )
        }
        const ok = st(e.to) === 'up' && st(e.from) !== 'down' && st(e.from) !== 'standby'
        const broken = st(e.to) === 'down' && st(e.from) !== 'standby'
        return (
          <FlowEdge
            key={key}
            from={pos[e.from]}
            to={pos[e.to]}
            color={broken ? '#8a2433' : ok ? C.cyan : '#3b4a63'}
            width={e.kind === 'hard' ? 1.4 : 1}
            opacity={broken ? 0.55 : ok ? (e.kind === 'hard' ? 0.75 : 0.45) : 0.3}
            flow={ok ? 0.9 : 0}
            height={0.6}
            dashed
          />
        )
      })}

      {showAll && topo.replication.map((r) => {
        if (!pos[r.from] || !pos[r.to]) return null
        const live = st(r.from) === 'up'
        return (
          <FlowEdge
            key={`rep-${r.from}`}
            from={pos[r.from]}
            to={pos[r.to]}
            color={live ? C.green : '#2b4a3f'}
            width={live ? 2 : 1.2}
            opacity={live ? 0.85 : 0.4}
            flow={live ? (r.mode === 'sync' ? 3 : 1.6) : 0}
            height={2.2}
          />
        )
      })}
    </group>
  )
}
