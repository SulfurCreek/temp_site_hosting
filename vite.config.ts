import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 掃描 public/inputs/{floorplans,references,products}，產生 /inputs/manifest.json。
 * - dev：每次請求即時掃描，丟進新檔案後重新整理頁面即可在 UI 看到。
 * - build：輸出到 dist/inputs/manifest.json。
 */
const INPUT_DIRS = ['floorplans', 'references', 'products'] as const
const EXT = /\.(png|jpe?g|webp|gif|svg|avif|glb|gltf)$/i

function scanInputs(root: string) {
  const out: Record<string, { name: string; url: string; kind: 'image' | 'model' }[]> = {}
  for (const dir of INPUT_DIRS) {
    const abs = path.join(root, 'public', 'inputs', dir)
    let files: string[] = []
    try {
      files = fs.readdirSync(abs).filter((f) => EXT.test(f)).sort()
    } catch {
      /* folder may not exist */
    }
    out[dir] = files.map((f) => ({
      name: f.replace(/\.[^.]+$/, ''),
      url: `/inputs/${dir}/${encodeURIComponent(f)}`,
      kind: /\.(glb|gltf)$/i.test(f) ? 'model' : 'image',
    }))
  }
  return out
}

function inputsManifest(): Plugin {
  let root = process.cwd()
  return {
    name: 'inputs-manifest',
    configResolved(c) {
      root = c.root
    },
    configureServer(server) {
      server.middlewares.use('/inputs/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(scanInputs(root)))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'inputs/manifest.json',
        source: JSON.stringify(scanInputs(root)),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inputsManifest()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
