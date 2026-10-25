import { ContactShadows, SoftShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useFxTier } from '../lib/fx'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

/** 地板上方 1 mm 的接觸陰影：家具腳、櫃體底部與牆角貼緊地面；低品質（手機）不啟用 */
export function FloorContact() {
  const tier = useFxTier()
  const studio = useUi((s) => s.studio)
  const proof = useLayout((s) => !!s.settings.colorProof)
  const floor = useLayout((s) => s.layout.floor)
  if (tier === 'low' || proof) return null
  return (
    <ContactShadows
      position={[floor.center[0], 0.001, floor.center[1]]}
      opacity={0.65}
      scale={Math.max(10, Math.max(floor.size[0], floor.size[1]) + 2)}
      blur={1.5}
      far={0.8}
      resolution={studio ? 2048 : 512}
      frames={Infinity}
    />
  )
}

/** PCSS 柔化陰影（距離越遠越柔）。為避免即時模式變慢，只在相片級算圖模式啟用 */
export function StudioSoftShadows() {
  const studio = useUi((s) => s.studio)
  return studio ? <SoftShadows size={25} samples={16} focus={0.5} /> : null
}

/** 匯出 4K PNG：暫時把 pixel ratio 拉到輸出 4K 寬度，等數幀渲染完成後輸出畫布，再還原 */
export function StudioExport() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const setDpr = useThree((s) => s.setDpr)
  const nonce = useUi((s) => s.exportNonce)
  const seen = useRef(nonce)
  const wait = useRef(-1)
  const restore = useRef(2)

  useEffect(() => {
    if (nonce === seen.current) return
    seen.current = nonce
    const maxDim = Math.min(gl.capabilities.maxTextureSize, (gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE) as number))
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    const targetW = Math.min(mobile ? 2560 : 3840, maxDim, Math.floor((maxDim * size.width) / Math.max(size.width, size.height)))
    restore.current = gl.getPixelRatio()
    useUi.getState().setExporting(true)
    setDpr(targetW / size.width)
    wait.current = 4
  }, [nonce, gl, size.width, size.height, setDpr])

  useFrame(() => {
    if (wait.current < 0) return
    if (wait.current-- > 0) return
    wait.current = -1
    const canvas = gl.domElement
    const { width, height } = canvas
    canvas.toBlob((b) => {
      setDpr(restore.current)
      useUi.getState().setExporting(false)
      if (!b) return useUi.getState().showToast('匯出失敗：此裝置無法輸出該解析度')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `render-${width}x${height}-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      useUi.getState().showToast(`已匯出 ${width} × ${height} PNG`)
    }, 'image/png')
  }, 1001)

  return null
}
