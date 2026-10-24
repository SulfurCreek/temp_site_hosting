// 產生範例 .glb（木凳）：node scripts/make-sample-glb.mjs
// 用途：驗證「模式 A：.glb 模型」載入流程。實際專案請直接把真正的 .glb 放進 public/inputs/products/。
import fs from 'node:fs'

const positions = []
const normals = []
const indices = []

function box(cx, cy, cz, sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2
  const faces = [
    [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
  ]
  for (const [n, vs] of faces) {
    const base = positions.length / 3
    for (const v of vs) {
      positions.push(cx + v[0], cy + v[1], cz + v[2])
      normals.push(...n)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

// 木凳：座面 0.4 × 0.04 × 0.4，四隻腳，總高 0.45
box(0, 0.43, 0, 0.4, 0.04, 0.4)
for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.16, 0.205, sz * 0.16, 0.05, 0.41, 0.05)

const pos = new Float32Array(positions)
const nor = new Float32Array(normals)
const idx = new Uint16Array(indices)
const pad4 = (n) => (n + 3) & ~3
const posBytes = pos.byteLength
const norBytes = nor.byteLength
const idxBytes = idx.byteLength
const bin = Buffer.alloc(pad4(posBytes + norBytes + idxBytes))
Buffer.from(pos.buffer).copy(bin, 0)
Buffer.from(nor.buffer).copy(bin, posBytes)
Buffer.from(idx.buffer).copy(bin, posBytes + norBytes)

let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
  min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k])
}

const gltf = {
  asset: { version: '2.0', generator: 'make-sample-glb.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Stool' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'Wood', pbrMetallicRoughness: { baseColorFactor: [0.72, 0.5, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
    { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes, byteLength: norBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes + norBytes, byteLength: idxBytes, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length }],
}

let json = Buffer.from(JSON.stringify(gltf))
json = Buffer.concat([json, Buffer.alloc(pad4(json.length) - json.length, 0x20)])
const total = 12 + 8 + json.length + 8 + bin.length
const out = Buffer.alloc(total)
let o = 0
out.writeUInt32LE(0x46546c67, o); o += 4 // glTF
out.writeUInt32LE(2, o); o += 4
out.writeUInt32LE(total, o); o += 4
out.writeUInt32LE(json.length, o); o += 4
out.writeUInt32LE(0x4e4f534a, o); o += 4 // JSON
json.copy(out, o); o += json.length
out.writeUInt32LE(bin.length, o); o += 4
out.writeUInt32LE(0x004e4942, o); o += 4 // BIN
bin.copy(out, o)
fs.writeFileSync(new URL('../public/inputs/products/sample-stool.glb', import.meta.url), out)
console.log('wrote sample-stool.glb', total, 'bytes')
