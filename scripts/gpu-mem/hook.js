// 注入頁面的 WebGL2 配置攔截器（見 measure.cjs）。window.__gpuMem() 回傳目前存活的貼圖 / renderbuffer 位元組明細。
(() => {
  const P = WebGL2RenderingContext.prototype
  const GL = WebGL2RenderingContext
  const BPP = {
    [GL.RGBA8]: 4, [GL.SRGB8_ALPHA8]: 4, [GL.RGBA16F]: 8, [GL.RGBA32F]: 16, [GL.R8]: 1, [GL.RG8]: 2, [GL.R16F]: 2, [GL.R32F]: 4,
    [GL.RG16F]: 4, [GL.RG32F]: 8, [GL.RGB8]: 4, [GL.RGB16F]: 8, [GL.RGB32F]: 16, [GL.DEPTH_COMPONENT16]: 2, [GL.DEPTH_COMPONENT24]: 4,
    [GL.DEPTH_COMPONENT32F]: 4, [GL.DEPTH24_STENCIL8]: 4, [GL.DEPTH32F_STENCIL8]: 8, [GL.RGB10_A2]: 4, [GL.R11F_G11F_B10F]: 4,
    [GL.RGBA4]: 2, 0x8E8C: 1, 0x8E8D: 1, 0x93B0: 1, 0x93D0: 1, 0x9278: 1, 0x9279: 1, 0x83F3: 1, 0x83F0: 0.5, 0x9274: 0.5, [GL.RGB565]: 2, [GL.RGB5_A1]: 2, [GL.STENCIL_INDEX8]: 1,
  }
  const NAME = {}
  for (const k in GL) if (typeof GL[k] === 'number' && BPP[GL[k]] !== undefined) NAME[GL[k]] = k
  const typeB = { [GL.UNSIGNED_BYTE]: 1, [GL.HALF_FLOAT]: 2, [GL.FLOAT]: 4, [GL.UNSIGNED_INT]: 4, [GL.UNSIGNED_SHORT]: 2, [GL.UNSIGNED_INT_24_8]: 4 }
  const chans = { [GL.RGBA]: 4, [GL.RGB]: 4, [GL.RED]: 1, [GL.RG]: 2, [GL.DEPTH_COMPONENT]: 1, [GL.DEPTH_STENCIL]: 1, [GL.LUMINANCE]: 1, [GL.ALPHA]: 1, [GL.LUMINANCE_ALPHA]: 2 }
  let id = 0
  const tex = new Map(), rb = new Map()
  const st = new WeakMap()
  const S = (gl) => { let s = st.get(gl); if (!s) { s = { unit: 0, b: {}, rb: null }; st.set(gl, s) } return s }
  const oc = P.createTexture; P.createTexture = function () { const t = oc.call(this); t.__id = ++id; tex.set(t.__id, { levels: {}, w: 0, h: 0, fmt: '', cube: false }); return t }
  const od = P.deleteTexture; P.deleteTexture = function (t) { if (t) tex.delete(t.__id); return od.call(this, t) }
  const oa = P.activeTexture; P.activeTexture = function (u) { S(this).unit = u; return oa.call(this, u) }
  const ob = P.bindTexture; P.bindTexture = function (tg, t) { S(this).b[S(this).unit + ':' + (tg === GL.TEXTURE_CUBE_MAP || (tg >= GL.TEXTURE_CUBE_MAP_POSITIVE_X && tg <= GL.TEXTURE_CUBE_MAP_NEGATIVE_Z) ? 'cube' : tg)] = t; return ob.call(this, tg, t) }
  const cur = (gl, tg) => { const cube = tg === GL.TEXTURE_CUBE_MAP || (tg >= GL.TEXTURE_CUBE_MAP_POSITIVE_X && tg <= GL.TEXTURE_CUBE_MAP_NEGATIVE_Z); const t = S(gl).b[S(gl).unit + ':' + (cube ? 'cube' : tg)]; return t && tex.get(t.__id) }
  const ots = P.texStorage2D; P.texStorage2D = function (tg, levels, f, w, h) {
    const r = cur(this, tg); if (r) { let b = 0, ww = w, hh = h; for (let i = 0; i < levels; i++) { b += ww * hh * (BPP[f] ?? 4); ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1) }; if (tg === GL.TEXTURE_CUBE_MAP) b *= 6; r.levels = { all: b }; r.w = w; r.h = h; r.fmt = (NAME[f] ?? f) + (tg === GL.TEXTURE_CUBE_MAP ? ' cube' : '') + ' L' + levels }
    return ots.apply(this, arguments) }
  const ots3 = P.texStorage3D; P.texStorage3D = function (tg, levels, f, w, h, d) { const r = cur(this, tg); if (r) { r.levels = { all: w * h * d * (BPP[f] ?? 4) * (levels > 1 ? 1.33 : 1) }; r.w = w; r.h = h; r.fmt = (NAME[f] ?? f) + ' 3D d' + d } return ots3.apply(this, arguments) }
  const oti = P.texImage2D; P.texImage2D = function (tg, level, f, a, b, c, d, e) {
    const r = cur(this, tg); if (r) { let w, h, fmt, ty; if (arguments.length >= 8) { w = a; h = b; fmt = d; ty = e } else { const src = c; w = src.width || src.videoWidth || src.naturalWidth; h = src.height || src.videoHeight || src.naturalHeight; fmt = a; ty = b }
      const bpp = BPP[f] ?? (chans[fmt] ?? 4) * (typeB[ty] ?? 1); r.levels[tg + ':' + level] = w * h * bpp; if (level === 0) { r.w = w; r.h = h; r.fmt = (NAME[f] ?? f) + ' img' } }
    return oti.apply(this, arguments) }
  const oct = P.compressedTexImage2D; P.compressedTexImage2D = function (tg, level, f, w, h, border, data) { const r = cur(this, tg); if (r) { r.levels[tg + ':' + level] = typeof data === 'number' ? data : data.byteLength; if (level === 0) { r.w = w; r.h = h; r.fmt = 'compressed 0x' + f.toString(16) } } return oct.apply(this, arguments) }
  const ocr = P.createRenderbuffer; P.createRenderbuffer = function () { const r = ocr.call(this); r.__id = ++id; rb.set(r.__id, { b: 0 }); return r }
  const odr = P.deleteRenderbuffer; P.deleteRenderbuffer = function (r) { if (r) rb.delete(r.__id); return odr.call(this, r) }
  const obr = P.bindRenderbuffer; P.bindRenderbuffer = function (tg, r) { S(this).rb = r; return obr.call(this, tg, r) }
  const ors = P.renderbufferStorage; P.renderbufferStorage = function (tg, f, w, h) { const r = S(this).rb; if (r) rb.set(r.__id, { b: w * h * (BPP[f] ?? 4), w, h, fmt: 'RB ' + (NAME[f] ?? f) }); return ors.apply(this, arguments) }
  const orm = P.renderbufferStorageMultisample; P.renderbufferStorageMultisample = function (tg, s, f, w, h) { const r = S(this).rb; if (r) rb.set(r.__id, { b: w * h * (BPP[f] ?? 4) * Math.max(1, s), w, h, fmt: 'RB MS' + s + ' ' + (NAME[f] ?? f) }); return orm.apply(this, arguments) }
  window.__gpuMem = () => {
    const rows = []
    for (const [k, r] of tex) { const b = Object.values(r.levels).reduce((a, x) => a + x, 0); if (b) rows.push({ kind: 'tex', w: r.w, h: r.h, fmt: r.fmt, MB: b / 1048576 }) }
    for (const [k, r] of rb) if (r.b) rows.push({ kind: 'rb', w: r.w, h: r.h, fmt: r.fmt, MB: r.b / 1048576 })
    const cv = document.querySelector('canvas'); const def = cv ? cv.width * cv.height * 8 : 0
    rows.push({ kind: 'default-fb', w: cv?.width, h: cv?.height, fmt: 'RGBA8+D24 (x1, compositor copies not counted)', MB: def / 1048576 })
    rows.sort((a, b) => b.MB - a.MB)
    return { totalMB: rows.reduce((a, r) => a + r.MB, 0), rows }
  }
})()
