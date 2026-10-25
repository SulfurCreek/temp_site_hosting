import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Effect, ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Uniform } from 'three'
import { useLayout } from '../store/layoutStore'

/** 標準對色光：不掛 EffectComposer，直接由 renderer 做色調映射 */
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
 * 後期渲染管線（所有裝置相同畫質）。順序固定為：N8AO（環境遮蔽）→ children → Bloom → 暖調白平衡 → ToneMapping → Vignette → SMAA。
 * 其他功能（例如 DepthOfField）請以 children 注入，會被放在 AO 之後、Bloom 之前：
 *
 *   <PostFX><DepthOfFieldFx /></PostFX>
 *
 * AO 以半解析度計算（N8AO 內建深度感知上採樣，肉眼與全解析度相近），只在出幀時執行；閒置不重繪。
 */
export function PostFX({ children }: { children?: ReactNode }) {
  const proof = useLayout((s) => !!s.settings.colorProof)
  if (proof) return <RendererTone proof={proof} />
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.4} intensity={3.5} distanceFalloff={0.8} quality="high" halfRes color="black" />
      {children}
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.05} intensity={0.5} mipmapBlur />
      <WarmGrade />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.1} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  )
}
