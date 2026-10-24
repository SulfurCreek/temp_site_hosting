import type * as THREE from 'three'

/** furniture id → 場景中的 Group，供 TransformControls 附著 */
export const objectRegistry = new Map<string, THREE.Object3D>()
