import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFxTier } from '../lib/fx'
import { useLayout } from '../store/layoutStore'

/** low 品質（手機）或標準對色光：不掛 EffectComposer，直接由 renderer 做色調映射 */
function RendererTone({ proof }: { proof: boolean }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const prev = { m: gl.toneMapping, e: gl.toneMappingExposure }
    // 對色光維持 Khronos Neutral（保留色票原色）；其餘使用電影級 ACES Filmic
    gl.toneMapping = proof ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = proof ? 1.08 : 1
    return () => {
      gl.toneMapping = prev.m
      gl.toneMappingExposure = prev.e
    }
  }, [gl, proof])
  return null
}

/**
 * 後期渲染管線。順序固定為：N8AO（環境遮蔽）→ children → Bloom → ToneMapping → SMAA。
 * 其他功能（例如 DepthOfField）請以 children 注入，會被放在 AO 之後、Bloom 之前：
 *
 *   <PostFX><DepthOfFieldFx /></PostFX>
 */
export function PostFX({ children }: { children?: ReactNode }) {
  const tier = useFxTier()
  const proof = useLayout((s) => !!s.settings.colorProof)
  if (tier === 'low' || proof) return <RendererTone proof={proof} />
  const high = tier === 'high'
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={0.5}
        intensity={3.5}
        distanceFalloff={1.0}
        quality={high ? 'high' : 'low'}
        halfRes={!high}
        color="black"
      />
      {children}
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.05} intensity={0.5} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  )
}
