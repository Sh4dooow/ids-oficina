// Oficina 3D (Three.js) — misma lógica que la versión pixel (bus de eventos), pero en 3D low-poly.
// Eventos que recibe por el bus: 'apariencia', 'estado', 'bocadillo', 'ceo'. Emite: 'click-agente'.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { MAPA, COLS, FILAS, MESAS, LUGARES } from './OficinaScene.js'
import { OPCIONES, APARIENCIA_DEFECTO } from './personaje.js'

const COMUN = { x0: 2, x1: 49, y0: 12, y1: 16 }
const PAL = {
  parquet: 0xb08a5a, moqueta: 0x3f4a6b, baldosa: 0xcfd6dd, pared: 0xe9e4da, paredTop: 0xd6d0c4, cristal: 0x9fd3ff,
  mesa: 0x8a6a46, mesaTop: 0xd9b98a, silla: 0x2b2f3f, monitor: 0x1b1b24, pantallaOff: 0x2a2f3d, pantallaOn: 0x7cc6ff,
  planta: 0x3f9b5c, maceta: 0xa0522d, cafetera: 0x444b5a, pizarra: 0x2f6b4f, sofa: 0x7a3d6b, alfombra: 0x5a3a7a,
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05, ...o })
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)

export default class Oficina3D {
  constructor(bus) {
    this.bus = bus; this.agentes = {}; this.estados = {}; this.apariencias = {}; this.monitores = {}
    this.walk = MAPA.map(f => [...f].map(ch => ch !== '#' && ch !== 'g'))
    this._raf = 0; this._last = performance.now()
  }

  montar(host) {
    this.host = host
    const W = host.clientWidth || 1040, H = host.clientHeight || 600
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(W, H)
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x0b0d12)
    host.appendChild(this.renderer.domElement)
    this.labels = new CSS2DRenderer(); this.labels.setSize(W, H)
    Object.assign(this.labels.domElement.style, { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' })
    host.appendChild(this.labels.domElement)

    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x0b0d12, 70, 120)
    this.camera = new THREE.PerspectiveCamera(38, W / H, 0.5, 300)
    this.camera.position.set(COLS / 2 + 10, 30, FILAS / 2 + 27)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(COLS / 2, 0, FILAS / 2); this.controls.maxPolarAngle = Math.PI / 2.25; this.controls.minDistance = 14; this.controls.maxDistance = 80
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.update()

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x3a2e22, 0.7))
    const sol = new THREE.DirectionalLight(0xfff1d6, 1.6); sol.position.set(COLS / 2 - 20, 45, FILAS / 2 + 25); sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048); const sc = sol.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 120
    this.scene.add(sol)

    this.construirMapa(); this.construirMuebles(); this.construirPersonajes()
    this.bus.on('apariencia', ({ id, apariencia, nombre }) => this.setApariencia(id, apariencia, nombre))
    this.bus.on('estado', (estados) => { this.estados = estados; this.aplicarEstados() })
    this.bus.on('bocadillo', ({ id, texto }) => this.bocadillo(id, texto))
    this.bus.on('ceo', (ev) => this.accionCeo(ev))
    this.aplicarEstados()

    // clic sobre personajes
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this._down = null
    this.renderer.domElement.addEventListener('pointerdown', (e) => { this._down = [e.clientX, e.clientY] })
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!this._down || Math.hypot(e.clientX - this._down[0], e.clientY - this._down[1]) > 6) return
      const r = this.renderer.domElement.getBoundingClientRect()
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      this.ray.setFromCamera(this.mouse, this.camera)
      const hits = this.ray.intersectObjects(Object.values(this.agentes).map(a => a.g), true)
      if (hits.length) { let o = hits[0].object; while (o && !o.userData.agente) o = o.parent; if (o) this.bus.emit('click-agente', o.userData.agente) }
    })
    this._onResize = () => this.redimensionar(); window.addEventListener('resize', this._onResize)
    this.ro = new ResizeObserver(() => this.redimensionar()); this.ro.observe(host)
    const loop = (t) => { this._raf = requestAnimationFrame(loop); const dt = Math.min(50, t - this._last); this._last = t; this.update(t, dt); this.controls.update(); this.renderer.render(this.scene, this.camera); this.labels.render(this.scene, this.camera) }
    this._raf = requestAnimationFrame(loop)
  }

  redimensionar() {
    const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.renderer.setSize(W, H); this.labels.setSize(W, H)
  }

  destruir() {
    cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); this.ro?.disconnect()
    this.renderer.dispose(); this.host.innerHTML = ''
  }

  // ---------- mapa: suelos y paredes a partir del MAPA de la versión pixel ----------
  construirMapa() {
    const suelos = { '.': mat(PAL.parquet), ',': mat(PAL.moqueta), ':': mat(PAL.baldosa), D: mat(PAL.parquet) }
    const geoSuelo = new THREE.PlaneGeometry(1, 1); geoSuelo.rotateX(-Math.PI / 2)
    const porTipo = {}
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAPA[y][x]; const k = suelos[ch] ? ch : '.'
      ;(porTipo[k] ||= []).push([x, y])
    }
    for (const [k, celdas] of Object.entries(porTipo)) {
      const im = new THREE.InstancedMesh(geoSuelo, suelos[k], celdas.length); im.receiveShadow = true
      const m = new THREE.Matrix4(); celdas.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, 0, y + 0.5); im.setMatrixAt(i, m) })
      this.scene.add(im)
    }
    // paredes y cristales (altas en el borde, bajas por dentro para ver todo)
    const mPared = mat(PAL.pared), mCristal = new THREE.MeshPhysicalMaterial({ color: PAL.cristal, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 })
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAPA[y][x]; if (ch !== '#' && ch !== 'g') continue
      const borde = x === 0 || y === 0 || x === COLS - 1 || y === FILAS - 1
      const h = ch === 'g' ? 1.6 : borde ? 2.6 : 1.9
      const w = box(1, h, 1, ch === 'g' ? mCristal : mPared); w.position.set(x + 0.5, h / 2, y + 0.5); w.castShadow = ch !== 'g'; w.receiveShadow = true
      this.scene.add(w)
    }
    // base oscura alrededor
    const base = box(COLS + 30, 0.4, FILAS + 30, mat(0x101319)); base.position.set(COLS / 2, -0.25, FILAS / 2); base.receiveShadow = true; this.scene.add(base)
  }

  mesa(x, y, id) {
    const g = new THREE.Group()
    const top = box(2, 0.12, 1, mat(PAL.mesaTop)); top.position.set(1, 0.78, 0.5); top.castShadow = true; g.add(top)
    for (const [px, pz] of [[0.1, 0.1], [1.9, 0.1], [0.1, 0.9], [1.9, 0.9]]) { const p = box(0.1, 0.75, 0.1, mat(PAL.mesa)); p.position.set(px, 0.37, pz); g.add(p) }
    const mon = box(0.9, 0.55, 0.06, mat(PAL.monitor)); mon.position.set(1, 1.18, 0.35); mon.castShadow = true; g.add(mon)
    const pant = box(0.8, 0.46, 0.02, new THREE.MeshStandardMaterial({ color: PAL.pantallaOff, emissive: PAL.pantallaOff, emissiveIntensity: 0.4 })); pant.position.set(1, 1.18, 0.39); g.add(pant)
    const pie = box(0.1, 0.25, 0.1, mat(PAL.monitor)); pie.position.set(1, 0.95, 0.35); g.add(pie)
    const tec = box(0.7, 0.04, 0.25, mat(0x3a3f4e)); tec.position.set(1, 0.86, 0.72); g.add(tec)
    g.position.set(x, 0, y); this.scene.add(g)
    if (id) this.monitores[id] = pant
  }
  silla(x, y) {
    const g = new THREE.Group(); const m = mat(PAL.silla)
    const as = box(0.6, 0.08, 0.6, m); as.position.set(0.5, 0.45, 0.5); g.add(as)
    const re = box(0.6, 0.5, 0.08, m); re.position.set(0.5, 0.75, 0.78); g.add(re)
    const pie = box(0.08, 0.45, 0.08, m); pie.position.set(0.5, 0.22, 0.5); g.add(pie)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), m); base.position.set(0.5, 0.02, 0.5); g.add(base)
    g.position.set(x, 0, y); this.scene.add(g)
  }
  planta(x, y) {
    const g = new THREE.Group()
    const mac = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10), mat(PAL.maceta)); mac.position.set(0.5, 0.2, 0.5); mac.castShadow = true; g.add(mac)
    for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(PAL.planta)); h.position.set(0.5 + Math.cos(i * 1.3) * 0.18, 0.65 + (i % 2) * 0.15, 0.5 + Math.sin(i * 1.3) * 0.18); h.castShadow = true; g.add(h) }
    g.position.set(x, 0, y); this.scene.add(g)
  }
  construirMuebles() {
    for (const [id, m] of Object.entries(MESAS)) {
      const mx = m.x - 1, my = m.y - 1
      this.mesa(mx, my, id); this.silla(m.x, m.y)
    }
    // recepción / zona común
    const mostrador = box(5, 1, 0.8, mat(0x6b4f35)); mostrador.position.set(LUGARES.recepcion.x + 1, 0.5, LUGARES.recepcion.y - 1.5); mostrador.castShadow = true; this.scene.add(mostrador)
    const caf = box(0.6, 0.9, 0.6, mat(PAL.cafetera)); caf.position.set(LUGARES.cafetera.x + 0.5, 0.45, LUGARES.cafetera.y + 0.5); caf.castShadow = true; this.scene.add(caf)
    const luzCaf = new THREE.PointLight(0xffa64d, 0.8, 5); luzCaf.position.set(LUGARES.cafetera.x + 0.5, 1.4, LUGARES.cafetera.y + 0.5); this.scene.add(luzCaf)
    // sala de reuniones: mesa grande + sofás
    const mesaR = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.12, 24), mat(PAL.mesaTop)); mesaR.position.set(LUGARES.reunion.x + 0.5, 0.78, LUGARES.reunion.y + 0.5); mesaR.castShadow = true; this.scene.add(mesaR)
    const pieR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.75, 12), mat(PAL.mesa)); pieR.position.set(LUGARES.reunion.x + 0.5, 0.37, LUGARES.reunion.y + 0.5); this.scene.add(pieR)
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.silla(LUGARES.reunion.x + Math.cos(a) * 2.6, LUGARES.reunion.y + Math.sin(a) * 2.6) }
    const alf = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), mat(PAL.alfombra)); alf.rotation.x = -Math.PI / 2; alf.position.set(LUGARES.reunion.x + 0.5, 0.01, LUGARES.reunion.y + 0.5); alf.receiveShadow = true; this.scene.add(alf)
    for (const [x, y] of [[2, 11], [12, 11], [27, 11], [45, 11], [2, 16], [49, 16], [39, 27], [14, 2], [28, 9], [2, 9]]) this.planta(x, y)
    // escuela: pizarra + pupitres
    const piz = box(3, 1.2, 0.1, mat(PAL.pizarra)); piz.position.set(46.5, 1.3, 19.6); this.scene.add(piz)
    const marco = box(3.2, 1.4, 0.06, mat(0x8a6a46)); marco.position.set(46.5, 1.3, 19.57); this.scene.add(marco)
    for (const [x, y] of [[40, 22], [44, 22], [48, 22], [40, 25], [44, 25], [48, 25]]) { this.mesa(x, y); this.silla(x + 1, y + 1) }
    // rótulos de zonas
    const rot = (x, y, t) => { const d = document.createElement('div'); d.className = 'rotulo3d'; d.textContent = t; const o = new CSS2DObject(d); o.position.set(x, 2.2, y); this.scene.add(o) }
    rot(6, 2, 'RECEPCIÓN'); rot(20, 2, 'DESPACHO CEO'); rot(39, 2, 'JEFE'); rot(26, 12, 'ZONA COMÚN')
    rot(6, 20, 'CREADOR 2'); rot(19, 20, 'CREADOR'); rot(31, 20, 'EDITOR'); rot(44, 20, 'ESCUELA')
  }

  // ---------- personajes low-poly a partir de la apariencia ----------
  crearFigura(ap) {
    const a = { ...APARIENCIA_DEFECTO, ...(ap || {}) }
    const piel = OPCIONES.piel[a.piel] || OPCIONES.piel.clara, pelo = OPCIONES.pelo_color[a.pelo_color] || OPCIONES.pelo_color.negro, ropa = a.ropa_color || '#4a90e2'
    const g = new THREE.Group()
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 10), mat(ropa)); cuerpo.position.y = 0.75; cuerpo.castShadow = true; g.add(cuerpo)
    const pant = mat(0x2b2f3f)
    const pi = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 3, 8), pant); pi.position.set(-0.13, 0.25, 0); pi.castShadow = true; g.add(pi)
    const pd = pi.clone(); pd.position.x = 0.13; g.add(pd)
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat(piel)); cab.position.y = 1.4; cab.castShadow = true; g.add(cab)
    if (a.pelo !== 'calvo') {
      const alto = { largo: 0.5, rizado: 0.34, mono: 0.3, rapado: 0.2 }[a.pelo] ?? 0.26
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(pelo)); h.position.y = 1.43; h.scale.y = alto / 0.26; g.add(h)
      if (a.pelo === 'largo') { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.45, 12, 1, true), mat(pelo)); l.position.set(0, 1.25, -0.05); g.add(l) }
      if (a.pelo === 'mono') { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(pelo)); m.position.set(0, 1.72, -0.12); g.add(m) }
      if (a.pelo === 'flequillo') { const f = box(0.42, 0.08, 0.1, mat(pelo)); f.position.set(0, 1.5, 0.22); g.add(f) }
    }
    if (a.accesorio === 'gafas' || a.accesorio === 'gafas_sol') { const gf = box(0.42, 0.1, 0.06, a.accesorio === 'gafas' ? mat(0x222222) : mat(0x111111)); gf.position.set(0, 1.42, 0.24); g.add(gf) }
    if (a.accesorio === 'gorra') { const go = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0xc0392b)); go.position.y = 1.47; g.add(go); const vis = box(0.4, 0.04, 0.25, mat(0xc0392b)); vis.position.set(0, 1.5, 0.3); g.add(vis) }
    if (a.accesorio === 'auriculares') { const au = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 16, Math.PI), mat(0x222222)); au.position.y = 1.42; g.add(au) }
    const ojos = mat(0x1b1b24); for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), ojos); o.position.set(s * 0.09, 1.44, 0.24); g.add(o) }
    const bi = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 3, 8), mat(ropa)); bi.position.set(-0.36, 0.78, 0); bi.castShadow = true; g.add(bi)
    const bd = bi.clone(); bd.position.x = 0.36; g.add(bd)
    g.userData.partes = { pi, pd, bi, bd, cab }
    return g
  }

  construirPersonajes() {
    for (const [id, m] of Object.entries(MESAS)) {
      const esCeo = id === 'ceo'
      const apDef = esCeo ? { ropa: 'camisa', ropa_color: '#e8e8e8', pelo: 'corto', pelo_color: 'castano' } : {}
      const g = new THREE.Group(); g.userData.agente = id
      const fig = this.crearFigura(this.apariencias[id] || apDef); fig.scale.setScalar(1.3); g.add(fig)
      const et = document.createElement('div'); et.className = 'etiqueta3d' + (esCeo ? ' ceo' : ''); et.textContent = id === 'tiendas' ? 'CREADOR 2' : m.nombre
      const etO = new CSS2DObject(et); etO.position.set(0, 2.5, 0); g.add(etO)
      const bu = document.createElement('div'); bu.className = 'bocadillo3d'
      const buO = new CSS2DObject(bu); buO.position.set(0, 3.1, 0); buO.visible = false; g.add(buO)
      g.position.set(m.x + 0.5, 0, m.y + 0.5); g.rotation.y = Math.PI
      this.scene.add(g)
      this.agentes[id] = { id, g, fig, et, bu, buO, tx: m.x, ty: m.y, path: [], estado: esCeo ? 'ceo' : 'libre', sentado: true, timer: 0, tarea: '', fase: 0, casa: { x: m.x, y: m.y }, volver: null, buTimer: null }
    }
    this.ceo = this.agentes.ceo
  }

  setApariencia(id, apariencia, nombre) {
    this.apariencias[id] = apariencia || {}
    const a = this.agentes[id]; if (!a) return
    a.g.remove(a.fig); a.fig = this.crearFigura(this.apariencias[id]); a.fig.scale.setScalar(1.3); a.g.add(a.fig)
    if (nombre) a.et.textContent = nombre.toUpperCase()
  }

  bocadillo(id, texto) {
    const a = this.agentes[id]; if (!a) return
    a.bu.textContent = (texto || '').slice(0, 90); a.buO.visible = true
    clearTimeout(a.buTimer); a.buTimer = setTimeout(() => { a.buO.visible = false }, 7000)
  }

  accionCeo({ accion, texto, agente }) {
    const c = this.ceo; if (!c) return
    const destinoDe = { tarea: 'jefe', mensaje: 'jefe', aprobar: agente || 'creador', rechazar: agente || 'creador', corregir: agente || 'creador', terminar: 'ceo', leccion: 'escuela' }
    const d = destinoDe[accion] || 'jefe'
    let dest
    if (d === 'ceo') dest = c.casa
    else if (d === 'escuela') dest = { x: 46, y: 21 }
    else { const m = MESAS[d] || MESAS.jefe; dest = { x: m.x - 2, y: m.y } }
    this.bocadillo('ceo', texto); this.irA(c, dest.x, dest.y)
    if (d !== 'ceo') { clearTimeout(c.volver); c.volver = setTimeout(() => { this.bocadillo(d, '👍 Recibido, Iván'); this.irA(c, c.casa.x, c.casa.y) }, 9000) }
  }

  aplicarEstados() {
    for (const [id, a] of Object.entries(this.agentes)) {
      const e = this.estados[id] || {}; const nuevo = e.estado || (id === 'ceo' ? 'ceo' : 'libre')
      if (nuevo !== a.estado) {
        a.estado = nuevo
        if (nuevo === 'trabajando') { this.irA(a, MESAS[id].x, MESAS[id].y); this.bocadillo(id, e.tarea ? '💻 ' + e.tarea : '💻 A trabajar') }
        else if (nuevo === 'esperando') this.irA(a, LUGARES.recepcion.x + Object.keys(this.agentes).indexOf(id) * 2, LUGARES.recepcion.y)
        else a.timer = 0
      }
      a.tarea = e.tarea || ''
    }
  }

  irA(a, tx, ty) { const path = this.bfs(a.tx, a.ty, tx, ty); if (path) { a.path = path; a.sentado = false } }

  bfs(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return []
    const key = (x, y) => y * COLS + x; const prev = new Map(); const q = [[sx, sy]]; prev.set(key(sx, sy), null)
    while (q.length) {
      const [x, y] = q.shift()
      if (x === tx && y === ty) { const out = []; let k = key(x, y); while (prev.get(k) !== null) { const [px, py] = prev.get(k); out.push({ x: k % COLS, y: Math.floor(k / COLS) }); k = key(px, py) } return out.reverse() }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= FILAS) continue
        const ok = this.walk[ny][nx] || (nx === tx && ny === ty); if (!ok || prev.has(key(nx, ny))) continue
        prev.set(key(nx, ny), [x, y]); q.push([nx, ny])
      }
    }
    return null
  }
  tileLibre(z) { for (let i = 0; i < 60; i++) { const x = z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1)), y = z.y0 + Math.floor(Math.random() * (z.y1 - z.y0 + 1)); if (this.walk[y]?.[x]) return { x, y } } return null }

  update(time, dt) {
    for (const [id, pant] of Object.entries(this.monitores)) {
      const a = this.agentes[id]; const on = a && a.estado === 'trabajando' && a.sentado
      pant.material.emissive.setHex(on ? PAL.pantallaOn : PAL.pantallaOff); pant.material.emissiveIntensity = on ? 0.9 + 0.3 * Math.sin(time / 180) : 0.3
    }
    for (const a of Object.values(this.agentes)) {
      const g = a.g, p = a.fig.userData.partes
      if (a.path.length) {
        const n = a.path[0], nx = n.x + 0.5, nz = n.y + 0.5
        const dx = nx - g.position.x, dz = nz - g.position.z, dist = Math.hypot(dx, dz), v = 2.6 * dt / 1000
        if (dist <= v) { g.position.set(nx, 0, nz); a.tx = n.x; a.ty = n.y; a.path.shift(); if (!a.path.length) { a.sentado = (a.tx === MESAS[a.id].x && a.ty === MESAS[a.id].y); if (a.sentado) g.rotation.y = Math.PI } }
        else { g.position.x += dx / dist * v; g.position.z += dz / dist * v; g.rotation.y = Math.atan2(dx, dz) }
        a.fase += dt / 90; const s = Math.sin(a.fase)
        p.pi.rotation.x = s * 0.6; p.pd.rotation.x = -s * 0.6; p.bi.rotation.x = -s * 0.5; p.bd.rotation.x = s * 0.5
        g.position.y = Math.abs(Math.sin(a.fase)) * 0.04
      } else {
        p.pi.rotation.x = p.pd.rotation.x = 0; p.bi.rotation.x = p.bd.rotation.x = 0; g.position.y = 0
        a.timer += dt
        if (a.estado === 'libre' && a.id !== 'ceo' && a.timer > 6000 + Math.random() * 8000) {
          a.timer = 0; const r = Math.random(); let dest = null
          if (r < 0.25) dest = { x: LUGARES.cafetera.x, y: LUGARES.cafetera.y + 1 }
          else if (r < 0.45) dest = this.tileLibre(MESAS[a.id].despacho)
          else if (r < 0.6) dest = this.tileLibre({ x0: 23, x1: 28, y0: 12, y1: 16 })
          else if (r < 0.72) dest = this.tileLibre({ x0: 40, x1: 49, y0: 20, y1: 27 })
          else if (r < 0.82) dest = this.tileLibre({ x0: 15, x1: 25, y0: 2, y1: 8 })
          else dest = this.tileLibre(COMUN)
          if (dest) this.irA(a, dest.x, dest.y)
        }
        if (a.estado === 'trabajando' && !a.sentado) this.irA(a, MESAS[a.id].x, MESAS[a.id].y)
        if (a.estado === 'trabajando' && a.sentado) { p.bi.rotation.x = -1.1 + Math.sin(time / 120) * 0.15; p.bd.rotation.x = -1.1 + Math.cos(time / 140) * 0.15; p.cab.rotation.x = 0.15 }
        else if (a.sentado) { p.cab.rotation.x = 0; p.cab.rotation.y = Math.sin(time / 900) * 0.3 }
      }
    }
  }
}
