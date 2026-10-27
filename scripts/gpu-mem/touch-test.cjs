const { chromium } = require('playwright')
const url = process.argv[2] || 'http://127.0.0.1:5173/?lean=1'
const out = process.argv[3] || '/tmp/claude-0/s'
;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const logs = []
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
  await page.goto(url)
  await page.waitForTimeout(15000)
  const cdp = await ctx.newCDPSession(page)
  await page.evaluate(() => {
    const g = window.__r3f()
    const P = Object.getPrototypeOf(g.raycaster)
    window.__rc = 0; window.__stacks = {}
    for (const m of ['intersectObject', 'intersectObjects']) { const o = P[m]; P[m] = function () { window.__rc++; const k = (new Error().stack.split('\n').slice(2, 5).map((x) => x.trim().replace(/\(.*\//, '(')).join(' < ')); window.__stacks[k] = (window.__stacks[k] || 0) + 1; return o.apply(this, arguments) } }
    window.__frames = 0
    const r = g.gl.render.bind(g.gl); g.gl.render = (...a) => { window.__frames++; return r(...a) }
  })
  const snap = () => page.evaluate(() => ({ rc: window.__rc, frames: window.__frames, ev: window.__r3f().events.enabled }))
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  console.log('idle 3s frames:', await (async () => { const a = await snap(); await page.waitForTimeout(3000); const b = await snap(); return b.frames - a.frames })())
  // 單指旋轉
  const a = await snap()
  await touch('touchStart', [{ x: 200, y: 400 }])
  let during
  let afterStart
  afterStart = await snap()
  for (let i = 0; i < 25; i++) { await touch('touchMove', [{ x: 200 + i * 5, y: 400 + i }]); await page.waitForTimeout(25); if (i === 12) during = await snap() }
  const beforeEnd = await snap()
  console.log('raycasts: at touchStart', afterStart.rc - a.rc, 'during 25 touchmoves', beforeEnd.rc - afterStart.rc)
  await touch('touchEnd', [])
  const b = await snap()
  await page.waitForTimeout(2500)
  const c = await snap()
  console.log(JSON.stringify(await page.evaluate(() => Object.entries(window.__stacks).sort((a, b) => b[1] - a[1]).slice(0, 4)), null, 1))
  console.log('rotate: raycasts during drag', b.rc - a.rc, 'events.enabled mid-drag', during.ev, 'frames in drag', b.frames - a.frames, 'after end', c.ev)
  const d = await snap(); await page.waitForTimeout(3000); const e = await snap()
  console.log('idle after gesture 3s frames:', e.frames - d.frames)
  // 雙指縮放
  const z0 = await snap()
  await touch('touchStart', [{ x: 150, y: 450 }, { x: 250, y: 450 }])
  for (let i = 0; i < 15; i++) { await touch('touchMove', [{ x: 150 - i * 4, y: 450 }, { x: 250 + i * 4, y: 450 }]); await page.waitForTimeout(25) }
  await touch('touchEnd', [])
  const z1 = await snap()
  console.log('pinch: raycasts', z1.rc - z0.rc, 'frames', z1.frames - z0.frames)
  await page.waitForTimeout(2500)
  // tap a furniture (sofa area) -> selection
  await page.screenshot({ path: out + '/touch-after-pinch.png' })
  await page.evaluate(() => window.__ui.getState().select({ type: 'furniture', id: window.__layout.getState().layout.furniture[0].id }))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: out + '/touch-selected.png' })
  console.log(logs.filter((l) => /error|warn/i.test(l) && !/Clock/.test(l)).slice(0, 8).join('\n'))
  await browser.close()
})()
