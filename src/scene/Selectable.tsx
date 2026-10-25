import type { ReactNode } from 'react'
import { useStore, type SceneSelection } from '../store'

/** The nearest object owns hover and click; orbit drags must not open a dialog. */
export function Selectable({ selection, children }: { selection: SceneSelection; children: ReactNode }) {
  const selectObject = useStore((s) => s.selectObject)
  const hoverObject = useStore((s) => s.hoverObject)
  return <group
    onClick={(e) => {
      e.stopPropagation()
      if (e.delta <= 4) selectObject(selection)
    }}
    onPointerOver={(e) => {
      e.stopPropagation()
      if (e.pointerType !== 'touch') hoverObject(selection)
    }}
    onPointerOut={() => {
      const current = useStore.getState().hovered
      if (current?.kind === selection.kind && current.id === selection.id) hoverObject(null)
    }}
  >{children}</group>
}
