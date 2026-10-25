import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { WorldState } from '../sim/world'
import { mmss } from './format'
import { Icon } from './Icon'

export function Terminal({ world }: { world: WorldState }) {
  const box = useRef<HTMLDivElement>(null)
  const lines = world.logs.slice(-160)
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [lines.length])
  return <section className="terminal"><div ref={box} className="term-body">
    {lines.length === 0 && <p className="muted">아직 실행 기록이 없습니다.</p>}
    {lines.map((l, i) => <div key={i} className={'line ' + l.level}><time>{mmss(l.t)}</time>{l.text}</div>)}
  </div></section>
}

export function Timeline() {
  const t = useStore((s) => s.t)
  const duration = useStore((s) => s.duration)
  const playing = useStore((s) => s.playing)
  const mult = useStore((s) => s.mult)
  const setPlaying = useStore((s) => s.setPlaying)
  const setMult = useStore((s) => s.setMult)
  const seek = useStore((s) => s.seek)
  return <div className="timeline">
    <button className="play-button" aria-label={playing ? '일시정지' : t >= duration ? '다시 재생' : '재생'} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : t >= duration ? 'reset' : 'play'} size={16} /></button>
    <time>{mmss(t)}</time>
    <input aria-label="재생 위치" type="range" min="0" max={duration || 1} step="0.1" value={t} onChange={(e) => seek(Number(e.target.value))} />
    <time className="total-time">{mmss(duration)}</time>
    <select aria-label="재생 속도" value={mult} onChange={(e) => setMult(Number(e.target.value))}>{[0.5, 1, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}</select>
    <button className="icon-button" title="결과 바로 보기" aria-label="결과 바로 보기" onClick={() => { seek(duration); setPlaying(false) }}><Icon name="skip" size={16} /></button>
  </div>
}
