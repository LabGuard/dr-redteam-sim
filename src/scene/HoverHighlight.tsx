import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import { useStore, type SceneSelection } from '../store'
import { SITE_LABEL, type Topology } from '../sim/model'
import { C, RACK, servicePositions } from './layout'

type Vec3 = [number, number, number]
const ignoreRaycast = () => {}

function bounds(topo: Topology, selection: SceneSelection): { name: string; position: Vec3; size: Vec3 } | null {
  const { kind, id } = selection
  if (kind === 'site' || kind === 'room') {
    const room = topo.rooms.find((r) => r.id === id)
    const rect = kind === 'site' ? id === 'main' ? [-14.2, -4.4, -0.4, 4.4] : [2.4, -3.6, 10.8, 3.6] : room?.rect
    if (!rect) return null
    const [x0, z0, x1, z1] = rect
    return { name: kind === 'site' ? SITE_LABEL[id as 'main' | 'dr'] : room!.name, position: [(x0 + x1) / 2, kind === 'site' ? -0.25 : 0.32, (z0 + z1) / 2], size: [x1 - x0 + 0.08, kind === 'site' ? 0.54 : 0.66, z1 - z0 + 0.08] }
  }
  if (kind === 'rack') {
    const rack = topo.racks.find((r) => r.id === id)
    return rack ? { name: '서버 랙 ' + id, position: [rack.pos[0], RACK.h / 2, rack.pos[1]], size: [RACK.w + 0.1, RACK.h + 0.1, RACK.d + 0.1] } : null
  }
  if (kind === 'infra') {
    const infra = topo.infra.find((i) => i.id === id)
    if (!infra) return null
    const size: Vec3 = infra.kind === 'ups' ? [1.6, 1.6, 1.7] : [1.05, 2, 1.3]
    return { name: infra.name, position: [infra.pos[0], (size[1] - 0.1) / 2, infra.pos[1]], size }
  }
  const service = topo.services.find((s) => s.id === id)
  return service ? { name: service.name, position: servicePositions(topo)[id].toArray(), size: [0.8, 0.24, 0.8] } : null
}

/** A separate shell leaves all equipment/status materials intact. It never takes pointer hits. */
export function HoverHighlight() {
  const topo = useStore((s) => s.topo)
  const hovered = useStore((s) => s.hovered)
  const canvas = useThree((s) => s.gl.domElement)
  const target = useMemo(() => hovered && bounds(topo, hovered), [topo, hovered])
  useEffect(() => {
    canvas.style.cursor = target ? 'pointer' : 'auto'
    return () => { canvas.style.cursor = 'auto' }
  }, [canvas, target])
  if (!target) return null
  return <group position={target.position}>
    <mesh raycast={ignoreRaycast}>
      <boxGeometry args={target.size} />
      <meshBasicMaterial color={C.teal} transparent opacity={0.065} depthWrite={false} toneMapped={false} />
      <Edges raycast={ignoreRaycast} color="#8cf5d9" lineWidth={1.5} transparent opacity={0.85} toneMapped={false} />
    </mesh>
    <Html position={[0, target.size[1] / 2 + 0.55, 0]} center pointerEvents="none" zIndexRange={[35, 30]}>
      <div className="object-hover-label" role="tooltip">{target.name}<span aria-hidden="true">↗</span></div>
    </Html>
  </group>
}
