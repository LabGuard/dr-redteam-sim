import * as THREE from 'three'
import type { Topology } from '../sim/model'

export const C = {
  bg: '#03060c',
  cyan: '#3ee6ff',
  teal: '#2af5c4',
  green: '#34e39a',
  amber: '#ffb020',
  red: '#ff3b4e',
  dim: '#53627a',
  rack: '#121a26',
  rackEdge: '#2b3a52',
}

export const RACK = { w: 0.95, h: 2.1, d: 1.05 }
export const LAYER_Y = 4.4 // 논리(서비스) 층 높이

// 서비스 노드 위치: 랙 바로 위 공중. 한 랙에 여러 개면 좌우로 벌린다.
export function servicePositions(topo: Topology) {
  const pos: Record<string, THREE.Vector3> = {}
  const byRack = new Map<string, string[]>()
  for (const s of topo.services) byRack.set(s.rack, [...(byRack.get(s.rack) ?? []), s.id])
  for (const r of topo.racks) {
    const ids = byRack.get(r.id) ?? []
    ids.forEach((id, i) => {
      const n = ids.length
      // 랙 열 바깥쪽(통로 반대편)으로 부채꼴로 펼쳐 라벨이 겹치지 않게 한다
      const out = r.pos[1] < 0 ? -1 : 1
      const dx = (i - (n - 1) / 2) * 0.62
      const dz = out * (0.2 + (i % 2) * 0.9)
      const lift = (r.site === 'dr' ? 0.4 : 0) + i * 0.55
      pos[id] = new THREE.Vector3(r.pos[0] + dx, LAYER_Y + lift, r.pos[1] + dz)
    })
  }
  return pos
}

export function rackFacing(z: number) {
  return z < 0 ? 1 : -1 // 앞면이 통로(z=0) 쪽을 향한다
}
