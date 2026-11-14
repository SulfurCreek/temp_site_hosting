const { chromium } = require('playwright')
;(async () => {
  for (const u of ['?lean=1', '?lean=0']) {
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/' + u)
    await page.waitForTimeout(22000)
    const r = await page.evaluate(() => { const g = window.__r3f(); const sm = g.gl.shadowMap; const was = sm.needsUpdate; sm.needsUpdate = false; g.gl.info.reset(); g.gl.render(g.scene, g.camera); const c1 = g.gl.info.render.calls; sm.needsUpdate = true; g.gl.info.reset(); g.gl.render(g.scene, g.camera); const c2 = g.gl.info.render.calls; window.__x = { was, c1, c2 }; return { x: window.__x, calls: g.gl.info.render.calls, tris: g.gl.info.render.triangles, lights: (() => { let n = 0, sh = 0; g.scene.traverse((o) => { if (o.isLight) { n++; if (o.castShadow) sh++ } }); return n + ' lights / ' + sh + ' shadow' })(), progs: g.gl.info.programs.length } })
    console.log(u, JSON.stringify(r))
    await browser.close()
  }
})()
