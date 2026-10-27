import { Environment } from "@react-three/drei";
import { HDRI_URL } from "../lib/pbrTextures";
import { Suspense } from "react";
import * as THREE from "three";
import { kelvinToHex } from "../lib/color";
import { useLayout } from "../store/layoutStore";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { LEAN } from "../lib/lean";
import { BakedLights } from "./BakedLight";
import { Fixtures } from "./Fixtures";

/**
 * 燈光：標準對色光（colorProof）沿用舊的 5500K 打光；
 * 其餘情況為「真實燈具光源」——ambientLight 僅 0.1，主要光線來自 mep.json 的軌道燈 / 吸頂燈 /
 * 吊扇燈 / 嵌燈 / 燈條（見 Fixtures.tsx）。固定 4000K、全部迴路開啟。
 */
export function Lighting() {
  const proof = useLayout((s) => !!s.settings.colorProof);
  return proof ? <ProofRig /> : LEAN ? <LeanRig /> : <FixtureRig />;
}

/** 4000K 燈具色（與白色混合 15%，白牆接近中性白） */
const FIXTURE_COLOR = "#" + new THREE.Color("#ffffff").lerp(new THREE.Color(kelvinToHex(4000)), 0.15).getHexString();

/**
 * 行動端燈光：全場景只有 2 盞真實光源——hemisphereLight（天花板白光 / 木地板暖色反彈的全域光感）+ 1 盞帶陰影的 directionalLight
 * （陰影圖只在靜態時烘一次：見 lib/frameloop.ts 的 shadowMap.autoUpdate = false）。燈具光斑由 <BakedLights /> 的貼片呈現。
 */
function LeanRig() {
  return (
    <>
      <hemisphereLight args={["#fff3e4", "#b79d7e", LEAN_HEMI]} />
      <directionalLight
        position={[2.5, 11, 4.5]}
        color="#fff6ea"
        intensity={LEAN_SUN}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <BakedLights color={FIXTURE_COLOR} />
      <Fixtures color={FIXTURE_COLOR} />
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Environment files={HDRI_URL} background={false} environmentIntensity={LEAN_ENV} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

// 手機沒有後製與動態燈具：以半球光（全域光感）+ 帶陰影的日光（立體感）+ 環境貼圖（間接光）調出接近桌面版的明暗層次
const LEAN_HEMI = 0.5;
const LEAN_SUN = 1.7;
const LEAN_ENV = 0.45;

function FixtureRig() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <Fixtures color={FIXTURE_COLOR} />
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Environment files={HDRI_URL} background={false} environmentIntensity={0.08} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

/** 標準對色光：固定 5500K（D55）純白、不混色、不使用偏暖粉的 apartment HDR */
function ProofRig() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#ffffff", 1.1]} />
      <directionalLight
        position={[5, 11, 7]}
        color="#ffffff"
        intensity={2.8}
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
    </>
  );
}
