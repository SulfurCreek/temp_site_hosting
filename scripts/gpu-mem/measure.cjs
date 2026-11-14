/**
 * GPU 記憶體量測（無頭 Chromium / SwiftShader，非實機）：模擬 iPhone 15 Pro 的 393×852 視窗與指定 dpr，
 * 由 hook.js 攔截 WebGL 配置呼叫累加位元組，輸出定格 / 拖曳中 / 拖曳後的總量與明細，並存下畫面 PNG。
 * 用法（先 npm run dev）：node scripts/gpu-mem/measure.cjs [url] [輸出資料夾] [dpr=2] [iso|fp]
 * 需要 playwright（npm i -D playwright 或使用環境內建的）。數字是「邏輯配置量」，不含瀏覽器合成器與驅動額外開銷。
 */
const { chromium } = require('playwright')
const fs = require('fs')
const [url = 'http://127.0.0.1:5173/', out = 'gpu-mem-out', dpr = '2', mode = 'iso'] = process.argv.slice(2)
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: Number(dpr), isMobile: true, hasTouch: true })
  await ctx.addInitScript({ path: require('path').join(__dirname, 'hook.js') })
  await ctx.addInitScript(() => {
    const P = WebGL2RenderingContext.prototype
    window.__draws = 0
    const og = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (t, a) { if (t === 'webgl2') { const c = og.call(this, t, { ...(a || {}), preserveDrawingBuffer: true }); if (c && this.isConnected) window.__gl = c; return c } return og.call(this, t, a) }
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = P[m]; P[m] = function () { window.__draws++; return o.apply(this, arguments) } }
  })
  const page = await ctx.newPage()
  const logs = []
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
  await page.goto(url)
  const idle = async (min) => { await page.waitForTimeout(min); let last = -1; for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => window.__draws); if (d === last) break; last = d; await page.waitForTimeout(3000) } }
  const shot = async (name) => { const url = await page.evaluate(() => document.querySelector('canvas')?.toDataURL('image/png')); if (url) fs.writeFileSync(out + '/' + name + '.png', Buffer.from(url.split(',')[1], 'base64')) }
  await idle(20000)
  if (mode === 'fp') {
    await page.evaluate(() => window.__ui?.getState().setViewMode?.('firstPerson'))
    await idle(8000)
  }
  const settle = await page.evaluate(() => window.__gpuMem())
  // one frame draw count
  const frameDraws = await page.evaluate(async () => { window.__draws = 0; window.__r3f().invalidate(); await new Promise((r) => setTimeout(r, 3000)); return window.__draws })
  await shot('settled')
  // drag
  const box = { x: 196, y: 430 }
  await page.mouse.move(box.x, box.y); await page.mouse.down()
  for (let i = 0; i < 20; i++) { await page.mouse.move(box.x + i * 6, box.y + i * 2); await page.waitForTimeout(30) }
  const during = await page.evaluate(() => window.__gpuMem())
  await page.mouse.up()
  await idle(4000)
  const after = await page.evaluate(() => window.__gpuMem())
  await shot('after-drag')
  const lost = await page.evaluate(() => window.__gl?.isContextLost())
  fs.writeFileSync(out + '/report.json', JSON.stringify({ settle, during: during.totalMB, after: after.totalMB, frameDraws, lost, logs: logs.slice(-40) }, null, 1))
  const fmt = (r) => `${r.MB.toFixed(2).padStart(8)} MB  ${r.kind.padEnd(10)} ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ${r.fmt}`
  console.log('settled total', settle.totalMB.toFixed(1), 'MB; during drag', during.totalMB.toFixed(1), '; after', after.totalMB.toFixed(1), '; draws/frame', frameDraws, 'lost', lost)
  console.log(settle.rows.filter((r) => r.MB > 0.2).map(fmt).join('\n'))
  console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 10).join('\n'))
  await browser.close()
})()
