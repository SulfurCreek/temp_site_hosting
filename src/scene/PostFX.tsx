import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Effect, ToneMappingMode } from 'postprocessing'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Uniform } from 'three'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { getSafeLevel, reportDiag, useDiag } from '../lib/diagnostics'
import { useFx } from '../lib/frameloop'
import { leanN8AO } from '../lib/gpuLean'
import { ErrorBoundary } from '../ui/ErrorBoundary'
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
 * 動靜分離（見 lib/frameloop.ts）：互動前後管線結構與解析度完全相同（不重配 dpr / AO 模式 / 效果 pass，
 * iOS 會因此收回 WebGL context）；只有嚴重掉幀時才暫時關閉 AO（enabled 開關，不重建）。
 * 標準對色光（colorProof）：只保留中性色調映射 + SMAA（Canvas 原生 antialias 已關閉）。
 */
/** 後製管線失敗時的安全路徑：不掛 EffectComposer，只用 renderer 的色調映射（會在診斷報告中標示） */
function SafePost({ proof }: { proof: boolean }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const prev = gl.toneMapping
    gl.toneMapping = proof ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping
    return () => {
      gl.toneMapping = prev
    }
  }, [gl, proof])
  return null
}

export function PostFX({ children }: { children?: ReactNode }) {
  const proof = useLayout((s) => !!s.settings.colorProof)
  const broken = useDiag((s) => s.postBroken)
  if (broken || getSafeLevel() >= 2) return <SafePost proof={proof} />
  return (
    <ErrorBoundary fallback={<SafePost proof={proof} />} onError={(e) => reportDiag('postfx', e.message)}>
      <FullPost>{children}</FullPost>
    </ErrorBoundary>
  )
}

function FullPost({ children }: { children?: ReactNode }) {
  // 分段啟用：貼圖 / HDRI 上傳尚在進行時不同時配置 Bloom 等全解析度緩衝，降低載入瞬間的 GPU 記憶體尖峰（最終畫面與完整管線相同）
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 2500)
    const b = setTimeout(() => setStage(2), 4500)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  const proof = useLayout((s) => !!s.settings.colorProof)
  const hq = useFx((s) => s.hq)
  const level = useFx((s) => s.level)
  const aoRef = useCallback((p: unknown) => leanN8AO(p), [])
  if (stage === 0) return <SafePost proof={proof} />
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
        ref={aoRef}
        aoRadius={0.4}
        intensity={3.5}
        distanceFalloff={0.8}
        quality="high"
        enabled={hq || level < 2}
        color="black"
      />
      {children}
      {stage >= 2 ? <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.05} intensity={0.5} mipmapBlur /> : <></>}
      <WarmGrade />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.1} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  )
}
