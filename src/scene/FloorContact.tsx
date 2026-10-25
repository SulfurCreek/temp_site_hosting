import { ContactShadows } from '@react-three/drei'
import { useMemo } from 'react'
import { useLayout } from '../store/layoutStore'

/** 地板上方 1 mm 的接觸陰影：家具腳、櫃體底部與牆角貼緊地面。只在家具/牆變動時重烘一次（frames=1），不是每幀重畫 */
export function FloorContact() {
  const proof = useLayout((s) => !!s.settings.colorProof)
  const floor = useLayout((s) => s.layout.floor)
  const furniture = useLayout((s) => s.layout.furniture)
  const walls = useLayout((s) => s.layout.walls)
  // 資料變動就換 key，ContactShadows 重新烘焙一次
  const rev = useMemo(() => Math.random(), [furniture, walls])
  if (proof) return null
  return (
    <ContactShadows
      key={rev}
      position={[floor.center[0], 0.001, floor.center[1]]}
      opacity={0.65}
      scale={Math.max(10, Math.max(floor.size[0], floor.size[1]) + 2)}
      blur={1.5}
      far={0.8}
      resolution={1024}
      frames={1}
    />
  )
}
