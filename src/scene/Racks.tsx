import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Infra, Rack } from '../sim/model'
import type { RackState } from '../sim/events'
import { C, RACK, rackFacing } from './layout'

const UNITS = 7
const TEAL = new THREE.Color(C.teal)
const AMBER = new THREE.Color(C.amber)
const RED = new THREE.Color(C.red)
const BLACK = new THREE.Color('#000000')

export const RackView = memo(function RackView({ rack, state, temp }: { rack: Rack; state: RackState; temp: number }) {
  const face = rackFacing(rack.pos[1])
  const leds = useRef<THREE.MeshStandardMaterial[]>([])
  const cap = useRef<THREE.MeshStandardMaterial>(null)
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const changedAt = useRef(-10)
  const prev = useRef(state)
  const tempRef = useRef(temp)
  tempRef.current = temp
  const seeds = useMemo(() => Array.from({ length: UNITS }, () => Math.random() * 100), [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (prev.current !== state) {
      prev.current = state
      changedAt.current = now
    }
    const since = now - changedAt.current
    const heat = THREE.MathUtils.clamp((tempRef.current - 24) / 14, 0, 1)
    leds.current.forEach((m, i) => {
      if (!m) return
      if (state === 'off') {
        const flash = since < 0.5 ? (1 - since / 0.5) * 3 : 0
        m.emissive.copy(RED)
        m.emissiveIntensity = flash
        return
      }
      const base = state === 'bypass' ? AMBER : TEAL
      m.emissive.copy(base).lerp(RED, heat * 0.85)
      const twinkle = 0.55 + 0.45 * Math.sin(now * (3 + (seeds[i] % 5)) + seeds[i])
      const blink = state === 'bypass' ? (Math.sin(now * 6) > 0 ? 1 : 0.25) : 1
      m.emissiveIntensity = (1.4 + twinkle * 1.6) * blink
    })
    if (cap.current) {
      if (state === 'off') {
        cap.current.emissive.copy(since < 0.6 ? RED : BLACK)
        cap.current.emissiveIntensity = since < 0.6 ? (1 - since / 0.6) * 4 : 0
      } else {
        cap.current.emissive.copy(state === 'bypass' ? AMBER : TEAL).lerp(RED, heat)
        cap.current.emissiveIntensity = 0.5 + heat * 2.2 + (state === 'bypass' ? 0.4 * Math.sin(now * 6) : 0)
      }
    }
    if (body.current) body.current.color.set(state === 'off' ? '#0b0f16' : C.rack)
  })

  return (
    <group position={[rack.pos[0], 0, rack.pos[1]]}>
      <mesh position={[0, RACK.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[RACK.w, RACK.h, RACK.d]} />
        <meshStandardMaterial ref={body} color={C.rack} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* 상판 상태등 — 위에서 볼 때 가장 잘 보이는 신호 */}
      <mesh position={[0, RACK.h + 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RACK.w - 0.12, RACK.d - 0.12]} />
        <meshStandardMaterial ref={cap} color="#05080d" emissive={C.teal} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* 앞면 서버 유닛과 LED */}
      {Array.from({ length: UNITS }, (_, i) => (
        <group key={i} position={[0, 0.3 + i * 0.25, (face * RACK.d) / 2 + face * 0.006]}>
          <mesh>
            <boxGeometry args={[RACK.w - 0.14, 0.18, 0.012]} />
            <meshStandardMaterial color="#1b2636" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[-0.28, 0, face * 0.01]}>
            <boxGeometry args={[0.22, 0.035, 0.01]} />
            <meshStandardMaterial ref={(m) => { if (m) leds.current[i] = m }} color="#05080d" emissive={C.teal} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
})

export const InfraView = memo(function InfraView({ infra, on, burning }: { infra: Infra; on: boolean; burning: boolean }) {
  const led = useRef<THREE.MeshStandardMaterial>(null)
  const fan = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    if (led.current) {
      led.current.emissive.set(on ? (infra.kind === 'crac' ? '#4fb6ff' : C.amber) : C.red)
      led.current.emissiveIntensity = on ? 2 : Math.sin(clock.elapsedTime * 5) > 0 ? 1.5 : 0.2
    }
    if (fan.current && on) fan.current.rotation.y += dt * 9
  })
  if (infra.kind === 'ups') {
    return (
      <group position={[infra.pos[0], 0, infra.pos[1]]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[1.5, 1.5, 1.6]} />
          <meshStandardMaterial color={burning ? '#2a1410' : '#1a1f28'} metalness={0.5} roughness={0.6} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[0.76, 0.75, -0.6 + i * 0.3]}>
            <boxGeometry args={[0.02, 1.2, 0.22]} />
            <meshStandardMaterial color={burning ? '#3a1a10' : '#283447'} />
          </mesh>
        ))}
        <mesh position={[0.77, 1.38, 0.62]}>
          <boxGeometry args={[0.02, 0.08, 0.16]} />
          <meshStandardMaterial ref={led} color="#05080d" emissive={C.amber} toneMapped={false} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[infra.pos[0], 0, infra.pos[1]]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.95, 1.9, 1.2]} />
        <meshStandardMaterial color="#7f93ab" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.38, 32]} />
        <meshStandardMaterial color="#1b2636" />
      </mesh>
      <mesh ref={fan} position={[0, 1.92, 0]}>
        <boxGeometry args={[0.7, 0.01, 0.08]} />
        <meshStandardMaterial color="#3a4a60" />
      </mesh>
      <mesh position={[0.48, 1.6, 0]}>
        <boxGeometry args={[0.02, 0.08, 0.3]} />
        <meshStandardMaterial ref={led} color="#05080d" emissive="#4fb6ff" toneMapped={false} />
      </mesh>
    </group>
  )
})

// 항온항습기 찬 공기 흐름. 냉각이 멈추면 사라진다.
export function Airflow({ from, toX, on }: { from: [number, number]; toX: number; on: boolean }) {
  const N = 140
  const ref = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const data = useMemo(() => {
    const p = new Float32Array(N * 3)
    const v = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      p[i * 3] = from[0] + Math.random() * (toX - from[0])
      p[i * 3 + 1] = 0.15 + Math.random() * 1.6
      p[i * 3 + 2] = (Math.random() - 0.5) * 1.6
      v[i] = 1.2 + Math.random() * 1.6
    }
    return { p, v }
  }, [from, toX])
  const level = useRef(on ? 1 : 0)
  useFrame((_, dt) => {
    level.current += ((on ? 1 : 0) - level.current) * (1 - Math.exp(-dt * 2))
    if (mat.current) mat.current.opacity = 0.55 * level.current
    const g = ref.current?.geometry
    if (!g) return
    const p = g.attributes.position.array as Float32Array
    for (let i = 0; i < N; i++) {
      p[i * 3] += data.v[i] * dt * (0.3 + level.current)
      if (p[i * 3] > toX) {
        p[i * 3] = from[0]
        p[i * 3 + 2] = from[1] * 0.3 + (Math.random() - 0.5) * 1.6
      }
    }
    g.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.p, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color="#6cc8ff" size={0.07} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}
