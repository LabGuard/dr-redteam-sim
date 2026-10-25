import { afterEach, describe, expect, it } from 'vitest'
import { computeWorld, useStore } from './store'

afterEach(() => useStore.getState().reset())

describe('화면 상태와 결과 비교', () => {
  it('인증 이중화 후 콘솔을 정상으로 표시하며 사고로 멈춘 주 전산실은 유지한다', () => {
    useStore.getState().startIncident()
    useStore.getState().startRehearsal()
    useStore.setState({ draftFixes: ['auth-dual', 'db-sync'] })
    useStore.getState().applyAndRerun()
    useStore.getState().seek(useStore.getState().duration)
    const world = computeWorld(useStore.getState())
    expect(world.services['console-dr'].state).toBe('up')
    expect(world.services.auth.state).toBe('down')
    expect(world.racks.R01).toBe('off')
    expect(world.rpo.lost).toBe(0)
  })

  it('대책을 바꿔 재실행해도 이전 회차의 적용 대책을 보존한다', () => {
    useStore.getState().startIncident()
    useStore.getState().startRehearsal()
    useStore.setState({ draftFixes: ['auth-dual'] })
    useStore.getState().applyAndRerun()
    useStore.getState().toggleDraft('db-sync')
    useStore.getState().applyAndRerun()
    expect(useStore.getState().runFixes).toEqual([[], ['auth-dual'], ['auth-dual', 'db-sync']])
    expect(useStore.getState().runs.map((run) => run.lost)).toEqual([87, 87, 0])
  })

  it('처음으로 돌아가면 결과와 상세 연결 표시를 초기화한다', () => {
    useStore.getState().startIncident()
    useStore.getState().startRehearsal()
    useStore.getState().setShowServices(true)
    useStore.getState().reset()
    expect(useStore.getState().phase).toBe('idle')
    expect(useStore.getState().runs).toEqual([])
    expect(useStore.getState().runFixes).toEqual([])
    expect(useStore.getState().showServices).toBe(false)
  })
})
