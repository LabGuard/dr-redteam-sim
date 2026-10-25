import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore, useWorld } from '../store'
import type { Shot } from '../sim/events'
import { C } from './layout'
import { Ground, RoomView } from './Site'
import { Airflow, InfraView, RackView } from './Racks'
import { Fire } from './Fire'
import { ServiceLayer } from './ServiceLayer'
import { Selectable } from './Selectable'
import { HoverHighlight } from './HoverHighlight'
import { TransitionLayer } from './TransitionLayer'
import { sceneTransition } from './transitions'

const SHOTS: Record<Shot, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [-1.6, 15.5, 18.5], target: [-1.6, 1.2, 0.8] },
  battery: { pos: [-20, 11, 13.5], target: [-9, 1, 0] },
  mainRoom: { pos: [-12, 12, 14], target: [-5.6, 1.6, 0] },
  logical: { pos: [-6.5, 12.5, 13.5], target: [-4.8, 3.4, 0] },
  drSite: { pos: [11, 12.5, 15.5], target: [5.6, 2.6, 0] },
  edge: { pos: [-0.6, 18.5, 20.5], target: [-0.6, 3.2, 0] },
  recovered: { pos: [4, 16, 19], target: [2.5, 2.6, 0] },
}

function CameraDirector({ shot }: { shot: Shot }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const aspect = useThree((s) => s.size.width / s.size.height)
  const revision = useStore((s) => s.cameraRevision)
  const prevRevision = useRef(revision)
  const anim = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; to: (typeof SHOTS)[Shot] } | null>(null)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const requested = prevRevision.current !== revision ? SHOTS.overview : SHOTS[shot]
    prevRevision.current = revision
    const target = new THREE.Vector3(...requested.target)
    const pos = new THREE.Vector3(...requested.pos).sub(target).multiplyScalar(Math.max(1, 1.8 / aspect)).add(target)
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), to: { pos: pos.toArray() as [number, number, number], target: requested.target } }
  }, [shot, camera, aspect, revision])

  useFrame((_, dt) => {
    const a = anim.current
    const c = controls.current
    if (!a || !c) return
    a.t = Math.min(1, a.t + dt / 2.2)
    const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - Math.pow(-2 * a.t + 2, 3) / 2
    camera.position.lerpVectors(a.fromPos, new THREE.Vector3(...a.to.pos), e)
    c.target.lerpVectors(a.fromTarget, new THREE.Vector3(...a.to.target), e)
    if (a.t >= 1) anim.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      onStart={() => { anim.current = null; useStore.getState().hoverObject(null) }}
      maxPolarAngle={Math.PI * 0.46}
      minDistance={6}
      maxDistance={45}
    />
  )
}

function Player() {
  const advance = useStore((s) => s.advance)
  useFrame((_, dt) => advance(Math.min(dt, 0.1)))
  return null
}

function Scene() {
  const topo = useStore((s) => s.topo)
  const w = useWorld()
  const phase = useStore((s) => s.phase)
  const transition = sceneTransition(topo, w, phase)
  const battery = topo.rooms.find((r) => r.id === 'battery')!
  const fire = w.fire['battery'] ?? 0
  const cracOn = (w.infra['crac-1'] ?? true) || (w.infra['crac-2'] ?? true)

  return (
    <>
      <Ground />
      {topo.rooms.map((r) => (
        <Selectable key={r.id} selection={{ kind: 'room', id: r.id }}><RoomView room={r} state={w.rooms[r.id] ?? 'normal'} temp={w.temp[r.id] ?? 23} fire={w.fire[r.id] ?? 0} /></Selectable>
      ))}
      {topo.racks.map((r) => (
        <Selectable key={r.id} selection={{ kind: 'rack', id: r.id }}><RackView rack={r} state={w.racks[r.id] ?? 'on'} temp={w.temp[r.room] ?? 23} /></Selectable>
      ))}
      {topo.infra.map((i) => (
        <Selectable key={i.id} selection={{ kind: 'infra', id: i.id }}><InfraView infra={i} on={w.infra[i.id] ?? true} burning={i.room === 'battery' && fire > 0.3} /></Selectable>
      ))}
      <Airflow from={[-8.1, 0]} toX={-1.4} on={cracOn} />
      {fire > 0 && <Fire at={[(battery.rect[0] + battery.rect[2]) / 2, 0, 0]} intensity={fire} spread={[2.2, 4.4]} />}
      <ServiceLayer topo={topo} world={w} />
      <TransitionLayer topo={topo} transition={transition} />
      <HoverHighlight />
      <CameraDirector shot={phase === 'rehearsal' || phase === 'rerun' || phase === 'fix' ? 'edge' : w.shot} />
    </>
  )
}

export function World() {
  return (
    <Canvas
      shadows
      onPointerLeave={() => useStore.getState().hoverObject(null)}
      dpr={[1, 2]}
      camera={{ position: SHOTS.overview.pos, fov: 40, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 28, 70]} />
      <ambientLight intensity={0.35} color="#9fc4ff" />
      <hemisphereLight args={['#456896', '#04060b', 0.55]} />
      <directionalLight
        position={[-6, 18, 12]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <Scene />
      <Player />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.62} luminanceSmoothing={0.25} />
        <Vignette darkness={0.62} offset={0.28} />
      </EffectComposer>
    </Canvas>
  )
}
