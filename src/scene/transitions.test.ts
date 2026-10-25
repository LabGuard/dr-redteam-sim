import { afterEach, describe, expect, it } from 'vitest'
import { computeWorld, useStore } from '../store'
import { sceneTransition } from './transitions'

afterEach(() => useStore.getState().reset())
const current = () => {
  const s = useStore.getState()
  return sceneTransition(s.topo, computeWorld(s), s.phase)
}

describe('현재 시점의 전환 경로', () => {
  it('원본 서버가 멈추면 복제 흐름도 멈춘다', () => {
    expect(current()?.routes).toHaveLength(2)
    useStore.getState().startIncident()
    useStore.getState().seek(useStore.getState().duration)
    expect(current()).toBeNull()
  })

  it('되감기 시 실패 경로 대신 그 시점에 실행하던 복구 경로를 표시한다', () => {
    useStore.getState().startIncident()
    useStore.getState().startRehearsal()
    useStore.getState().seek(useStore.getState().duration)
    expect(current()).toMatchObject({ state: 'blocked', routes: [{ from: 'console-dr', to: 'auth' }] })
    useStore.getState().seek(55)
    expect(current()).toMatchObject({ state: 'running', action: '복제본 활성화', routes: [{ from: 'storage', to: 'storage-dr' }] })
    useStore.getState().seek(20)
    expect(current()?.routes).toEqual([{ from: 'db', to: 'db-dr' }])
    useStore.getState().seek(0)
    expect(current()).toBeNull()
  })

  it('이중화하면 인증 경로가 DR 내부로 바뀌고 성공한 접속 경로를 표시한다', () => {
    useStore.getState().startIncident()
    useStore.getState().startRehearsal()
    useStore.setState({ draftFixes: ['auth-dual', 'db-sync'] })
    useStore.getState().applyAndRerun()
    useStore.getState().seek(86)
    expect(current()).toMatchObject({ state: 'running', routes: [{ from: 'console-dr', to: 'auth-dr' }] })
    useStore.getState().seek(useStore.getState().duration)
    expect(current()).toMatchObject({ state: 'done', routes: [{ from: 'dns-dr', to: 'sugang-dr' }] })
    expect(computeWorld(useStore.getState()).rpo.lost).toBe(0)
  })
})
