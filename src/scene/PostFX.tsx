import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Effect, ToneMappingMode } from 'postprocessing'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Uniform } from 'three'
import { useFx } from '../lib/frameloop'
import { useLayout } from '../store/layoutStore'

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
 * 動靜分離（見 lib/frameloop.ts）：互動中 AO = 半解析度 performance（嚴重掉幀時再關閉）、旁路 children（景深）；
 * 停下 180 ms 後回到全解析度 high AO + 景深 + Bloom 的相片級畫面。
 * 標準對色光（colorProof）：只保留中性色調映射 + SMAA（Canvas 原生 antialias 已關閉）。
 */
export function PostFX({ children }: { children?: ReactNode }) {
  const proof = useLayout((s) => !!s.settings.colorProof)
  const hq = useFx((s) => s.hq)
  const level = useFx((s) => s.level)
  if (proof)
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
    )
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={0.4}
        intensity={3.5}
        distanceFalloff={0.8}
        quality={hq ? 'high' : 'performance'}
        halfRes={!hq}
        enabled={hq || level < 2}
        color="black"
      />
      {hq ? children : <></>}
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.05} intensity={0.5} mipmapBlur />
      <WarmGrade />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.1} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  )
}
