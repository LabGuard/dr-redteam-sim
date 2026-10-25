import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Line2, LineSegments2 } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../store'
import type { Topology } from '../sim/model'
import { C, RACK } from './layout'
import type { SceneTransition } from './transitions'

const ignoreRaycast = () => {}
const UP = new THREE.Vector3(0, 1, 0)

function TransferPath({ from, to, state, reduced }: { from: THREE.Vector3; to: THREE.Vector3; state: SceneTransition['state']; reduced: boolean }) {
  const line = useRef<Line2 | LineSegments2>(null)
  const packet = useRef<THREE.Mesh>(null)
  const arrival = useRef<THREE.Mesh>(null)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5)
    mid.y += Math.min(4.5, 1.1 + from.distanceTo(to) * 0.22)
    return new THREE.QuadraticBezierCurve3(from, mid, to)
  }, [from, to])
  const points = useMemo(() => curve.getPoints(64), [curve])
  const arrowPoint = useMemo(() => curve.getPoint(0.82), [curve])
  const arrowRotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, curve.getTangent(0.82).normalize()), [curve])
  const blocked = state === 'blocked'
  const color = blocked ? '#fa7685' : C.teal

  useFrame(({ clock }) => {
    // Use simulation time rather than wall time: pause, rewind and speed controls all agree.
    const store = useStore.getState()
    const time = reduced ? 0 : store.phase === 'idle' ? clock.elapsedTime : store.t * 0.35
    const moving = !blocked && state !== 'done' && !reduced
    if (line.current) line.current.material.dashOffset = moving ? -time * 0.7 : 0
    if (packet.current) curve.getPoint(moving ? (time * 0.18) % 1 : 0.5, packet.current.position)
    if (arrival.current && ringMaterial.current) {
      const pulse = moving ? (time * 0.65) % 1 : 0
      arrival.current.scale.setScalar(1 + pulse * 0.6)
      ringMaterial.current.opacity = moving ? 0.6 - pulse * 0.35 : 0.6
    }
  })

  return <group>
    <Line raycast={ignoreRaycast} ref={line} points={points} color={color} lineWidth={blocked ? 1.8 : 2} dashed dashSize={0.24} gapSize={0.2} transparent opacity={state === 'done' ? 0.45 : 0.72} toneMapped={false} />
    <mesh raycast={ignoreRaycast} position={from}>
      <sphereGeometry args={[0.07, 12, 8]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
    {!blocked && <mesh raycast={ignoreRaycast} position={arrowPoint} quaternion={arrowRotation}>
      <coneGeometry args={[0.12, 0.34, 8]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>}
    {!blocked && state !== 'done' && !reduced && <mesh raycast={ignoreRaycast} ref={packet} position={from}>
      <sphereGeometry args={[0.1, 12, 8]} /><meshBasicMaterial color="#b3ffe9" toneMapped={false} />
    </mesh>}
    <mesh raycast={ignoreRaycast} position={to} rotation={[-Math.PI / 2, 0, 0]} ref={arrival}>
      <ringGeometry args={[0.27, 0.31, 40]} /><meshBasicMaterial ref={ringMaterial} color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
    {blocked && <group position={to}>
      <Line raycast={ignoreRaycast} points={[[-0.2, 0.2, 0], [0.2, -0.2, 0]]} color={color} lineWidth={2.5} toneMapped={false} />
      <Line raycast={ignoreRaycast} points={[[-0.2, -0.2, 0], [0.2, 0.2, 0]]} color={color} lineWidth={2.5} toneMapped={false} />
    </group>}
  </group>
}

export function TransitionLayer({ topo, transition }: { topo: Topology; transition: SceneTransition | null }) {
  const showServices = useStore((s) => s.showServices)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const positions = useMemo(() => Object.fromEntries(topo.services.map((s) => {
    const rack = topo.racks.find((r) => r.id === s.rack)!
    return [s.id, new THREE.Vector3(rack.pos[0], RACK.h + 0.18, rack.pos[1])]
  })), [topo])
  if (!transition || showServices) return null
  return <group>{transition.routes.map((r) => positions[r.from] && positions[r.to] && <TransferPath key={transition.id + r.from + r.to} from={positions[r.from]} to={positions[r.to]} state={transition.state} reduced={reduced} />)}</group>
}
