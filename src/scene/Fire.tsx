import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vert = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uScale;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (1.0 - vLife * 0.5) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const fireFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = pow(smoothstep(0.5, 0.0, d), 1.6);
    vec3 hot = vec3(1.0, 0.95, 0.65);
    vec3 mid = vec3(1.0, 0.45, 0.08);
    vec3 cool = vec3(0.6, 0.05, 0.02);
    vec3 col = vLife < 0.35 ? mix(hot, mid, vLife / 0.35) : mix(mid, cool, (vLife - 0.35) / 0.65);
    float a = soft * (1.0 - vLife) * 0.55 * uOpacity;
    gl_FragColor = vec4(col * 1.8, a);
  }
`
const smokeFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, d);
    float a = soft * sin(vLife * 3.14159) * 0.32 * uOpacity;
    gl_FragColor = vec4(vec3(0.16, 0.15, 0.15), a);
  }
`

function useParticles(n: number) {
  return useMemo(() => {
    const pos = new Float32Array(n * 3)
    const life = new Float32Array(n)
    const size = new Float32Array(n)
    const vel = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) life[i] = Math.random()
    return { pos, life, size, vel }
  }, [n])
}

// 배터리실 화재: 불꽃 + 연기 + 깜빡이는 점광원. intensity(0~1)를 부드럽게 따라간다.
export function Fire({ at, intensity, spread = [1.4, 2.6] }: { at: [number, number, number]; intensity: number; spread?: [number, number] }) {
  const NF = 420
  const NS = 160
  const f = useParticles(NF)
  const s = useParticles(NS)
  const fireRef = useRef<THREE.Points>(null)
  const smokeRef = useRef<THREE.Points>(null)
  const light = useRef<THREE.PointLight>(null)
  const level = useRef(0)
  const target = useRef(intensity)
  target.current = intensity

  const fireMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: fireFrag, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 1100 }, uOpacity: { value: 0 } },
    }),
    [],
  )
  const smokeMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: smokeFrag, transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 1800 }, uOpacity: { value: 0 } },
    }),
    [],
  )

  const respawnFire = (i: number) => {
    const r = Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    f.pos[i * 3] = Math.cos(a) * r * spread[0] * 0.5
    f.pos[i * 3 + 1] = 0.2 + Math.random() * 0.6
    f.pos[i * 3 + 2] = Math.sin(a) * r * spread[1] * 0.5
    f.vel[i * 3] = (Math.random() - 0.5) * 0.3
    f.vel[i * 3 + 1] = 1.2 + Math.random() * 1.8
    f.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3
    f.size[i] = 0.8 + Math.random() * 1.6
    f.life[i] = 0
  }
  const respawnSmoke = (i: number) => {
    s.pos[i * 3] = (Math.random() - 0.5) * spread[0]
    s.pos[i * 3 + 1] = 1.6 + Math.random() * 0.8
    s.pos[i * 3 + 2] = (Math.random() - 0.5) * spread[1]
    s.vel[i * 3] = 0.15 + Math.random() * 0.35 // 서버실 쪽(+x)으로 번짐
    s.vel[i * 3 + 1] = 0.4 + Math.random() * 0.5
    s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3
    s.size[i] = 1.2 + Math.random() * 1.4
    s.life[i] = 0
  }

  useFrame(({ clock }, dt) => {
    level.current += (target.current - level.current) * (1 - Math.exp(-dt * 1.5))
    const L = level.current
    const step = Math.min(dt, 0.05)
    for (let i = 0; i < NF; i++) {
      f.life[i] += step * (0.9 + Math.random() * 0.6)
      if (f.life[i] >= 1) respawnFire(i)
      f.pos[i * 3] += f.vel[i * 3] * step + Math.sin(clock.elapsedTime * 4 + i) * 0.004
      f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * step * (0.5 + L)
      f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * step
    }
    for (let i = 0; i < NS; i++) {
      s.life[i] += step * 0.22
      if (s.life[i] >= 1) respawnSmoke(i)
      s.pos[i * 3] += s.vel[i * 3] * step
      s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * step
      s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * step
    }
    const fg = fireRef.current?.geometry
    const sg = smokeRef.current?.geometry
    if (fg) { fg.attributes.position.needsUpdate = true; fg.attributes.aLife.needsUpdate = true; fg.attributes.aSize.needsUpdate = true }
    if (sg) { sg.attributes.position.needsUpdate = true; sg.attributes.aLife.needsUpdate = true; sg.attributes.aSize.needsUpdate = true }
    fireMat.uniforms.uOpacity.value = Math.min(1, L * 1.6)
    smokeMat.uniforms.uOpacity.value = L
    if (light.current) {
      const flick = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 17) * Math.sin(clock.elapsedTime * 9.1)
      light.current.intensity = L * 38 * flick
    }
  })

  return (
    <group position={at}>
      <pointLight ref={light} color="#ff6a1a" distance={14} decay={1.6} position={[0, 1.4, 0]} />
      <points ref={fireRef} material={fireMat} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[f.pos, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[f.life, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[f.size, 1]} />
        </bufferGeometry>
      </points>
      <points ref={smokeRef} material={smokeMat} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[s.pos, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[s.life, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[s.size, 1]} />
        </bufferGeometry>
      </points>
    </group>
  )
}
