import { Environment } from "@react-three/drei";
import { HDRI_URL } from "../lib/pbrTextures";
import { Suspense } from "react";
import * as THREE from "three";
import { kelvinToHex } from "../lib/color";
import { useLayout } from "../store/layoutStore";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Fixtures } from "./Fixtures";

/**
 * 燈光：標準對色光（colorProof）沿用舊的 5500K 打光；
 * 其餘情況為「真實燈具光源」——ambientLight 僅 0.1，主要光線來自 mep.json 的軌道燈 / 吸頂燈 /
 * 吊扇燈 / 嵌燈 / 燈條（見 Fixtures.tsx）。固定 4000K、全部迴路開啟。
 */
export function Lighting() {
  const proof = useLayout((s) => !!s.settings.colorProof);
  return proof ? <ProofRig /> : <FixtureRig />;
}

/** 4000K 燈具色（與白色混合 15%，白牆接近中性白） */
const FIXTURE_COLOR = "#" + new THREE.Color("#ffffff").lerp(new THREE.Color(kelvinToHex(4000)), 0.15).getHexString();

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
