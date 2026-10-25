import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Grid, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '../sim/model'
import type { RoomState } from '../sim/events'
import { C } from './layout'
import { Selectable } from './Selectable'

const PLATFORMS = [
  { id: 'main', label: '주 전산실 · 본관', sub: '가상 대전 ○○대학 정보화본부', rect: [-14.2, -4.4, -0.4, 4.4] },
  { id: 'dr', label: 'DR 센터 · 제2캠퍼스', sub: '재해복구 사이트', rect: [2.4, -3.6, 10.8, 3.6] },
] as const

export function Ground() {
  return (
    <>
      <Grid
        position={[0, -0.52, 0]}
        infiniteGrid
        cellSize={0.6}
        sectionSize={3}
        cellThickness={0.5}
        sectionThickness={1}
        cellColor="#0b1a2b"
        sectionColor="#123354"
        fadeDistance={60}
        fadeStrength={2.2}
      />
      {PLATFORMS.map((p) => {
        const [x0, z0, x1, z1] = p.rect
        const w = x1 - x0
        const d = z1 - z0
        return (
          <Selectable key={p.id} selection={{ kind: 'site', id: p.id }}><group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]}>
            <mesh position={[0, -0.26, 0]} receiveShadow>
              <boxGeometry args={[w, 0.5, d]} />
              <meshStandardMaterial color="#0a1220" metalness={0.4} roughness={0.75} />
              <Edges color={p.id === 'main' ? '#2a6fa8' : '#1f8a68'} threshold={15} />
            </mesh>
            <Grid
              position={[0, 0.005, 0]}
              args={[w, d]}
              cellSize={0.5}
              sectionSize={2}
              cellThickness={0.6}
              sectionThickness={1.1}
              cellColor={p.id === 'main' ? '#10243a' : '#0f2a24'}
              sectionColor={p.id === 'main' ? '#1a4a75' : '#18604b'}
              fadeDistance={80}
            />
          </group></Selectable>
        )
      })}
    </>
  )
}

const tmpColor = new THREE.Color()
const COOL = new THREE.Color('#1b6dff')
const WARM = new THREE.Color('#ff8a1f')
const HOT = new THREE.Color('#ff2a3a')

export const RoomView = memo(function RoomView({ room, state, temp, fire }: { room: Room; state: RoomState; temp: number; fire: number }) {
  const [x0, z0, x1, z1] = room.rect
  const w = x1 - x0
  const d = z1 - z0
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const floor = useRef<THREE.MeshBasicMaterial>(null)
  const target = useRef({ temp, fire })
  target.current = { temp, fire }
  const cur = useRef({ temp, fire })

  const outline = useMemo(
    () => [
      [x0, 0.62, z0], [x1, 0.62, z0], [x1, 0.62, z1], [x0, 0.62, z1], [x0, 0.62, z0],
    ] as [number, number, number][],
    [x0, x1, z0, z1],
  )

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 3)
    cur.current.temp += (target.current.temp - cur.current.temp) * k
    cur.current.fire += (target.current.fire - cur.current.fire) * k
    const m = floor.current
    if (!m) return
    if (room.kind === 'battery') {
      const f = cur.current.fire
      const flick = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 13) * Math.sin(clock.elapsedTime * 7.3)
      m.color.copy(HOT).lerp(WARM, 0.4)
      m.opacity = f * 0.42 * flick
    } else {
      const h = THREE.MathUtils.clamp((cur.current.temp - 23) / 17, 0, 1)
      if (h < 0.5) tmpColor.copy(COOL).lerp(WARM, h * 2)
      else tmpColor.copy(WARM).lerp(HOT, (h - 0.5) * 2)
      m.color.copy(tmpColor)
      m.opacity = 0.05 + h * 0.38
    }
  })

  const lineColor = state === 'fire' || state === 'no_access' ? C.red : state === 'power_cut' ? '#7a4a20' : room.site === 'dr' ? '#2fb98b' : '#3a8fd6'
  return (
    <group>
      <mesh position={[cx, 0.02, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial ref={floor} transparent opacity={0.05} color={COOL} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* 낮은 벽 */}
      {[
        [cx, z0, w, 0.06], [cx, z1, w, 0.06],
      ].map(([x, z, ww, dd], i) => (
        <mesh key={`h${i}`} position={[x, 0.31, z]}>
          <boxGeometry args={[ww, 0.62, dd]} />
          <meshStandardMaterial color="#16304d" transparent opacity={0.35} />
        </mesh>
      ))}
      {[
        [x0, cz, 0.06, d], [x1, cz, 0.06, d],
      ].map(([x, z, ww, dd], i) => (
        <mesh key={`v${i}`} position={[x, 0.31, z]}>
          <boxGeometry args={[ww, 0.62, dd]} />
          <meshStandardMaterial color="#16304d" transparent opacity={0.35} />
        </mesh>
      ))}
      <Line points={outline} color={lineColor} lineWidth={1.4} transparent opacity={0.9} />
    </group>
  )
})
