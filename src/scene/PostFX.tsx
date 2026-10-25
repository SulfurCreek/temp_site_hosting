import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Effect, ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Uniform } from 'three'
import { useFxTier } from '../lib/fx'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

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

/** 建築攝影白平衡：色調映射前在線性空間對 RGB 微調，整體略偏暖但保持中性白牆 */
class WarmGradeEffect extends Effect {
  constructor(gain: THREE.Vector3) {
    super(
      'WarmGradeEffect',
      'uniform vec3 uGain; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * uGain, inputColor.a); }',
      { uniforms: new Map([['uGain', new Uniform(gain)]]) },
    )
  }
}

function WarmGrade() {
  const effect = useMemo(() => new WarmGradeEffect(new THREE.Vector3(1.03, 1.0, 0.955)), [])
  return <primitive object={effect} dispose={null} />
}

/**
 * 後期渲染管線。順序固定為：N8AO（環境遮蔽）→ children → Bloom → 暖調白平衡 → ToneMapping → Vignette → SMAA。
 * 其他功能（例如 DepthOfField）請以 children 注入，會被放在 AO 之後、Bloom 之前：
 *
 *   <PostFX><DepthOfFieldFx /></PostFX>
 *
 * 相片級算圖模式（uiStore.studio）：N8AO ultra、8x MSAA（取代 SMAA）。
 */
export function PostFX({ children }: { children?: ReactNode }) {
  const tier = useFxTier()
  const proof = useLayout((s) => !!s.settings.colorProof)
  const studio = useUi((s) => s.studio)
  if (tier === 'low' || proof) return <RendererTone proof={proof} />
  const high = tier === 'high'
  return (
    <EffectComposer multisampling={studio ? 8 : 0} enableNormalPass={false} key={studio ? 'studio' : 'live'}>
      <N8AO
        aoRadius={high ? 0.4 : 0.5}
        intensity={high ? 3.5 : 2.5}
        distanceFalloff={high ? 0.8 : 1.0}
        quality={studio ? 'ultra' : high ? 'high' : 'low'}
        halfRes={!high}
        color="black"
      />
      {children}
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.05} intensity={0.5} mipmapBlur />
      <WarmGrade />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.1} darkness={0.35} />
      {studio ? <></> : <SMAA />}
    </EffectComposer>
  )
}
