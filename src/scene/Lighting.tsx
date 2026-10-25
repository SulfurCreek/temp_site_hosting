import { Environment } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { kelvinToHex } from "../lib/color";
import { useFxTier } from "../lib/fx";
import { LIGHT_SCENES } from "../lib/lightScenes";
import { useLayout } from "../store/layoutStore";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Fixtures } from "./Fixtures";

/**
 * 燈光：標準對色光（colorProof）沿用舊的 5500K 打光；
 * 其餘情況改為「真實燈具光源」——ambientLight 僅 0.2 左右，主要光線來自 mep.json 的軌道燈 / 吸頂燈 /
 * 吊扇燈 / 嵌燈 / 燈條（見 Fixtures.tsx），並提供 全開 / 軌道 / 夜燈 / 日光 四種情境。
 */
export function Lighting() {
  const proof = useLayout((s) => !!s.settings.colorProof);
  return proof ? <ProofRig /> : <FixtureRig />;
}

function FixtureRig() {
  const sceneId = useLayout((s) => s.settings.lightScene ?? "all");
  const kelvin = useLayout((s) => s.settings.kelvin);
  const tier = useFxTier();
  const def = LIGHT_SCENES[sceneId];
  // 燈具色：以色溫與白色混合（同舊版規則），3000K 偏暖、4000K 接近中性
  const color = useMemo(() => {
    const mix = kelvin <= 3000 ? 0.55 : kelvin >= 6000 ? 0.5 : 0.15;
    return (
      "#" +
      new THREE.Color("#ffffff")
        .lerp(new THREE.Color(kelvinToHex(kelvin)), mix)
        .getHexString()
    );
  }, [kelvin]);
  const sunMap = tier === "high" ? 2048 : 1024;

  return (
    <>
      <ambientLight intensity={def.ambient} color={sceneId === "night" ? "#9fb2e8" : "#ffffff"} />
      {def.sun && (
        <directionalLight
          position={def.sun.position}
          color={def.sun.color}
          intensity={def.sun.intensity}
          castShadow={tier !== "low"}
          shadow-mapSize={[sunMap, sunMap]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-bias={-0.0004}
          shadow-normalBias={0.025}
          shadow-radius={5}
        />
      )}
      {def.moon && (
        <directionalLight position={def.moon.position} color={def.moon.color} intensity={def.moon.intensity} />
      )}
      <Fixtures scene={def} color={color} tier={tier} />
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Environment preset="apartment" environmentIntensity={def.env} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

/** 色溫 → 主光顏色；Environment（apartment 預設）提供真實室內反射光 */
function ProofRig() {
  const proof = useLayout((s) => !!s.settings.colorProof);
  const setting = useLayout((s) => s.settings.kelvin);
  // 標準對色光：固定 5500K（D55）純白、不混色、不使用偏暖粉的 apartment HDR
  const kelvin = proof ? 5500 : setting;
  // 人眼/相機會自動白平衡：純黑體色溫（4000K≈#ffd1a3）直接打在白牆上會偏橘，
  // 這裡依色溫與白色混合：3000K 仍明顯偏暖、6000K 偏冷，4000K 接近中性，白牆接近色票的白。
  const color = useMemo(() => {
    if (proof) return "#ffffff";
    const mix = kelvin <= 3000 ? 0.55 : kelvin >= 6000 ? 0.5 : 0.15;
    return (
      "#" +
      new THREE.Color("#ffffff")
        .lerp(new THREE.Color(kelvinToHex(kelvin)), mix)
        .getHexString()
    );
  }, [kelvin, proof]);
  const warm = kelvin < 3500;

  return (
    <>
      {/* apartment HDR 本身偏暖粉，用略偏冷的天光抵銷，讓 4000K 下白牆回到色票的中性白 */}
      <hemisphereLight
        args={[
          proof ? "#ffffff" : warm ? color : "#e6eeff",
          proof ? "#ffffff" : "#8d8a85",
          proof ? 1.1 : warm ? 0.6 : 0.75,
        ]}
      />
      <directionalLight
        position={[5, 11, 7]}
        color={color}
        intensity={warm ? 2.2 : 2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={5}
      />
      {!proof && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Environment
              preset="apartment"
              environmentIntensity={warm ? 0.4 : 0.32}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
