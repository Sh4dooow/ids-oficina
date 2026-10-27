import Phaser from 'phaser'
import { T, TILES, PROPS, makeTexture } from './pixel.js'
import { registrarPersonaje } from './personaje.js'

// ======================= MAPA 52x30 =======================
// # pared  g cristal  D puerta  . parquet  , moqueta  : baldosa
const F = (s) => s
export const MAPA = [
  '####################################################',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '#............#.............#.......................#',
  '######D###########D########gggggggggggDgggggggggggg#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#gggDgggggggg#gggDgggggggg#gggDggggggg####D#########',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '#............#............#...........#::::::::::::#',
  '####################################################',
].map(F)
export const COLS = MAPA[0].length, FILAS = MAPA.length
export const ANCHO = COLS * T, ALTO = FILAS * T

export const LUGARES = {
  recepcion: { x: 6, y: 6 }, cafetera: { x: 4, y: 12 }, listo: { x: 20, y: 6 }, reunion: { x: 26, y: 14 }, escuela: { x: 44, y: 24 },
}
// Silla de cada agente (tile donde se sienta) + su despacho (zona para deambular dentro)
export const MESAS = {
  jefe:    { x: 39, y: 5,  nombre: 'JEFE',    despacho: { x0: 29, x1: 49, y0: 2, y1: 8 } },
  tiendas: { x: 6,  y: 23, nombre: 'TIENDAS', despacho: { x0: 2, x1: 11, y0: 20, y1: 27 } },
  creador: { x: 19, y: 23, nombre: 'CREADOR', despacho: { x0: 15, x1: 24, y0: 20, y1: 27 } },
  editor:  { x: 31, y: 23, nombre: 'EDITOR',  despacho: { x0: 28, x1: 36, y0: 20, y1: 27 } },
  ceo:     { x: 19, y: 3,  nombre: 'IVÁN · CEO', despacho: { x0: 15, x1: 25, y0: 2, y1: 8 } },
}
const COMUN = { x0: 2, x1: 49, y0: 12, y1: 16 }

export default class OficinaScene extends Phaser.Scene {
  constructor(bus) { super('oficina'); this.bus = bus; this.agentes = {}; this.estados = {}; this.monitores = {}; this.apariencias = {}; this.nombres = {} }

  create() {
    const s = this
    Object.entries(TILES).forEach(([k, rows]) => makeTexture(s, 'tile-' + k, rows))
    Object.entries(PROPS).forEach(([k, rows]) => makeTexture(s, 'prop-' + k, rows))

    // ---------- suelo / paredes ----------
    this.walk = []
    for (let y = 0; y < FILAS; y++) {
      this.walk[y] = []
      for (let x = 0; x < COLS; x++) {
        const c = MAPA[y][x]
        let tex = 'tile-suelo', walkable = true
        if (c === ',') tex = 'tile-moqueta'
        else if (c === ':') tex = 'tile-baldosa'
        else if (c === '#') { const abajo = MAPA[y + 1]?.[x]; tex = (abajo && abajo !== '#' && abajo !== 'g') ? 'tile-pared' : 'tile-muro'; walkable = false }
        else if (c === 'g') { tex = 'tile-cristal'; walkable = false }
        else if (c === 'D') { tex = 'tile-puerta'; walkable = true }
        s.add.image(x * T, y * T, tex).setOrigin(0).setDepth(0)
        this.walk[y][x] = walkable
      }
    }

    const prop = (k, tx, ty, depth) => s.add.image(tx * T, ty * T, 'prop-' + k).setOrigin(0).setDepth(depth ?? ty * T + 8)
    const bloquear = (tx, ty, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.walk[ty + j]) this.walk[ty + j][tx + i] = false }
    const sombraMueble = (tx, ty, w) => s.add.ellipse(tx * T + w * 8, ty * T + 14, w * 16 + 4, 8, 0x000000, 0.18).setDepth(0.5)
    const luzTecho = (tx, ty, r = 70) => s.add.circle(tx * T, ty * T, r, 0xfff1c4, 0.035).setDepth(0.4)

    // ---------- Recepción (1-12, 1-9) ----------
    prop('mostrador', 4, 7); bloquear(4, 7, 3, 1); sombraMueble(4, 7, 3)
    prop('sofa', 1, 2); bloquear(1, 2, 2, 1); prop('sofa', 1, 4); bloquear(1, 4, 2, 1)
    prop('planta', 11, 1); bloquear(11, 1); prop('planta', 11, 8); bloquear(11, 8)
    prop('dispensador', 1, 8); bloquear(1, 8); prop('mesita', 3, 3); bloquear(3, 3); prop('impresora', 7, 7, 7 * T + 9)
    prop('ventana', 4, 0, 1); prop('ventana', 8, 0, 1); prop('cuadro', 6, 0, 1)
    luzTecho(6.5, 5)
    this.rotulo(1, 1, 'RECEPCIÓN')

    // ---------- Sala LISTO (14-26, 1-9) ----------
    prop('tele', 21, 1, 1); bloquear(21, 1, 2, 1)
    prop('sofa', 16, 4); bloquear(16, 4, 2, 1); prop('sofa', 22, 4); bloquear(22, 4, 2, 1)
    prop('estanteria', 14, 6); bloquear(14, 6, 2, 2); prop('estanteria', 24, 6); bloquear(24, 6, 2, 2)
    prop('planta', 25, 1); bloquear(25, 1)
    prop('ventana', 15, 0, 1); prop('ventana', 23, 0, 1)
    luzTecho(20, 5)
    this.rotulo(14, 1, 'DESPACHO DE IVÁN · CEO')
    { prop('mesa', 18, 2); bloquear(18, 2, 2, 1); sombraMueble(18, 2, 2)
      this.monitores.ceo = s.add.image(19 * T, 2 * T - 6, 'prop-monitorOff').setOrigin(0).setDepth(2 * T + 9)
      prop('teclado', 19, 2); prop('silla', 19, 3, 3 * T + 2) }

    // ---------- Despacho del Jefe (28-50, 1-9) ----------
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) s.add.image((36 + i) * T, (3 + j) * T, 'tile-alfombra').setOrigin(0).setDepth(0.2)
    prop('estanteria', 29, 1); bloquear(29, 1, 2, 2); prop('estanteria', 31, 1); bloquear(31, 1, 2, 2); prop('archivador', 34, 1); bloquear(34, 1); prop('impresora', 47, 1); bloquear(47, 1)
    prop('sofa', 45, 7); bloquear(45, 7, 2, 1); prop('sofa', 29, 7); bloquear(29, 7, 2, 1)
    prop('planta', 49, 1); bloquear(49, 1); prop('planta', 49, 8); bloquear(49, 8); prop('planta', 34, 8); bloquear(34, 8)
    prop('ventana', 36, 0, 1); prop('ventana', 42, 0, 1); prop('ventana', 47, 0, 1); prop('cuadro', 39, 0, 1)
    luzTecho(39, 5, 90)
    this.rotulo(28, 1, 'DESPACHO DEL JEFE')

    // ---------- Zona común (1-50, 11-17) ----------
    prop('cafetera', 3, 11); bloquear(3, 11); prop('dispensador', 5, 11); bloquear(5, 11)
    prop('mesaRedonda', 25, 13); bloquear(25, 13, 2, 2)
    prop('silla', 24, 14); prop('silla', 27, 14); prop('silla', 25, 12); prop('silla', 26, 15)
    prop('sofa', 10, 16); bloquear(10, 16, 2, 1); prop('sofa', 40, 16); bloquear(40, 16, 2, 1)
    prop('planta', 1, 11); bloquear(1, 11); prop('planta', 50, 11); bloquear(50, 11); prop('planta', 1, 17); bloquear(1, 17); prop('planta', 50, 17); bloquear(50, 17)
    prop('cuadro', 14, 10, 2); prop('cuadro', 22, 10, 2); prop('cuadro', 45, 18, 2)
    prop('estanteria', 46, 11); bloquear(46, 11, 2, 2)
    this.rotulo(8, 11, 'ZONA COMÚN')

    // ---------- Despachos (abajo) ----------
    const despacho = (id, x0, nombre) => {
      // mesa centrada, monitor, silla, planta, archivador, ventana
      const m = MESAS[id]; const mx = m.x - 1, my = m.y - 1
      prop('mesa', mx, my); bloquear(mx, my, 2, 1); sombraMueble(mx, my, 2)
      this.monitores[id] = s.add.image(m.x * T, my * T - 6, 'prop-monitorOff').setOrigin(0).setDepth(my * T + 9)
      prop('teclado', m.x, my); prop('silla', m.x, m.y, m.y * T + 2)
      const rug = { tiendas: 'tile-alfombraAzul', creador: 'tile-alfombra', editor: 'tile-alfombraVerde' }[id]
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.add.image((mx - 1 + i) * T, (my) * T + j * T, rug).setOrigin(0).setDepth(0.2)
      prop('estanteria', x0, 19); bloquear(x0, 19, 2, 2)
      prop('archivador', x0 + 2, 19); bloquear(x0 + 2, 19)
      prop('impresora', x0 + 8, 19); bloquear(x0 + 8, 19)
      prop('planta', x0 + 9, 19); bloquear(x0 + 9, 19)
      prop('planta', x0, 27); bloquear(x0, 27)
      prop('mesita', x0 + 7, 26); bloquear(x0 + 7, 26); prop('sofa', x0 + 8, 26); bloquear(x0 + 8, 26, 2, 1)
      prop('cuadro', x0 + 5, 18, 2)
      luzTecho(x0 + 5, 23)
      this.rotulo(x0 + 1, 27.2, nombre, true)
    }
    despacho('tiendas', 1, 'DESPACHO · TIENDAS')
    despacho('creador', 14, 'DESPACHO · CREADOR')
    despacho('editor', 27, 'DESPACHO · EDITOR')
    // Jefe
    { const m = MESAS.jefe; const mx = m.x - 1, my = m.y - 1
      prop('mesa', mx, my); bloquear(mx, my, 2, 1); sombraMueble(mx, my, 2)
      this.monitores.jefe = s.add.image(m.x * T, my * T - 6, 'prop-monitorOff').setOrigin(0).setDepth(my * T + 9)
      prop('teclado', m.x, my); prop('silla', m.x, m.y, m.y * T + 2) }

    // ---------- Escuela (39-50, 19-28) ----------
    prop('pizarra', 45, 19, 1); bloquear(45, 19, 3, 1)
    prop('mesa', 40, 22); bloquear(40, 22, 2, 1); prop('mesa', 44, 22); bloquear(44, 22, 2, 1); prop('mesa', 48, 22); bloquear(48, 22, 2, 1)
    prop('silla', 41, 23); prop('silla', 45, 23); prop('silla', 49, 23)
    prop('mesa', 40, 25); bloquear(40, 25, 2, 1); prop('mesa', 44, 25); bloquear(44, 25, 2, 1); prop('mesa', 48, 25); bloquear(48, 25, 2, 1)
    prop('silla', 41, 26); prop('silla', 45, 26); prop('silla', 49, 26)
    prop('planta', 39, 27); bloquear(39, 27)
    luzTecho(45, 24)
    this.rotulo(39, 19.1, 'ESCUELA')

    // ---------- personajes ----------
    this.bus.on('apariencia', ({ id, apariencia, nombre }) => this.setApariencia(id, apariencia, nombre))
    for (const [id, m] of Object.entries(MESAS)) {
      if (id === 'ceo') continue
      registrarPersonaje(s, 'pj-' + id, this.apariencias[id] || {})
      const spr = s.add.sprite(m.x * T + 8, m.y * T + 8, 'pj-' + id, 'up0').setOrigin(0.5, 0.78).setDepth(m.y * T + 10)
      const etiqueta = s.add.text(0, 0, m.nombre, { fontFamily: 'monospace', fontSize: '8px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(9999)
      const burbuja = s.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#111', backgroundColor: '#fffbe6', padding: { x: 4, y: 3 }, wordWrap: { width: 110 }, align: 'center' }).setOrigin(0.5, 1).setDepth(10000).setVisible(false)
      const sombra = s.add.ellipse(spr.x, spr.y + 1, 12, 5, 0x000000, 0.25).setDepth(m.y * T + 9)
      this.agentes[id] = { id, spr, etiqueta, burbuja, sombra, tx: m.x, ty: m.y, path: [], estado: 'libre', dir: 'up', sentado: true, timer: 0, tarea: '', zzz: 0 }
      spr.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.bus.emit('click-agente', id))
    }

    // ---------- Iván (CEO): se mueve cuando Iván actúa desde la web ----------
    { const cx = 19, cy = 3
      registrarPersonaje(s, 'pj-ceo', this.apariencias.ceo || { ropa: 'camisa', ropa_color: '#e8e8e8', pelo: 'corto', pelo_color: 'castano' })
      const spr = s.add.sprite(cx * T + 8, cy * T + 8, 'pj-ceo', 'up0').setOrigin(0.5, 0.78).setDepth(cy * T + 10)
      const etiqueta = s.add.text(0, 0, 'IVÁN · CEO', { fontFamily: 'monospace', fontSize: '8px', color: '#111', backgroundColor: '#ffd666', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(9999)
      const burbuja = s.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#111', backgroundColor: '#fffbe6', padding: { x: 4, y: 3 }, wordWrap: { width: 120 }, align: 'center' }).setOrigin(0.5, 1).setDepth(10000).setVisible(false)
      const sombra = s.add.ellipse(spr.x, spr.y + 1, 12, 5, 0x000000, 0.25).setDepth(cy * T + 9)
      this.ceo = { id: 'ceo', spr, etiqueta, burbuja, sombra, tx: cx, ty: cy, path: [], estado: 'ceo', dir: 'up', sentado: true, timer: 0, tarea: '', casa: { x: cx, y: cy }, volver: null }
      this.agentes.ceo = this.ceo
      spr.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.bus.emit('click-agente', 'ceo'))
      this.bus.on('ceo', (ev) => this.accionCeo(ev))
    }

    // monitores parpadeando
    s.time.addEvent({ delay: 450, loop: true, callback: () => {
      for (const [id, mon] of Object.entries(this.monitores)) {
        const a = this.agentes[id]
        if (a.estado === 'trabajando' && a.sentado) mon.setTexture(mon.texture.key === 'prop-monitorOn' ? 'prop-monitorOn2' : 'prop-monitorOn')
        else mon.setTexture('prop-monitorOff')
      }
    } })

    this.bus.on('estado', (estados) => { this.estados = estados; this.aplicarEstados() })
    this.bus.on('bocadillo', ({ id, texto }) => this.bocadillo(id, texto))
    this.aplicarEstados()
    s.cameras.main.setBackgroundColor('#0b0d12')
  }

  // Iván actúa desde la web: su personaje va a la mesa del agente que corresponde y lo dice en un bocadillo.
  accionCeo({ accion, texto, agente }) {
    const c = this.ceo; if (!c) return
    const destinoDe = { tarea: 'jefe', mensaje: 'jefe', aprobar: agente || 'creador', rechazar: agente || 'creador', corregir: agente || 'creador', terminar: 'ceo', leccion: 'escuela' }
    const d = destinoDe[accion] || 'jefe'
    let dest
    if (d === 'ceo') dest = c.casa
    else if (d === 'escuela') dest = { x: 46, y: 21 }
    else { const m = MESAS[d]; dest = { x: m.x - 2, y: m.y } }
    this.bocadillo('ceo', texto)
    this.irA(c, dest.x, dest.y)
    if (d !== 'ceo') {
      if (c.volver) c.volver.remove(false)
      c.volver = this.time.delayedCall(9000, () => { this.bocadillo(d, '👍 Recibido, Iván'); this.irA(c, c.casa.x, c.casa.y) })
    }
  }

  setApariencia(id, apariencia, nombre) {
    this.apariencias[id] = apariencia || {}
    const a = this.agentes[id]; if (!a) return
    registrarPersonaje(this, 'pj-' + id, this.apariencias[id])
    a.spr.setTexture('pj-' + id, `${a.sentado ? 'up' : a.dir}0`)
    if (nombre) a.etiqueta.setText(nombre.toUpperCase())
  }

  rotulo(tx, ty, texto, pequeno = false) {
    this.add.text(tx * T + 3, ty * T + 2, texto, { fontFamily: 'monospace', fontSize: pequeno ? '7px' : '8px', color: '#ffe9a8', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setDepth(5000)
  }

  bocadillo(id, texto) {
    const a = this.agentes[id]; if (!a) return
    a.burbuja.setText(texto.slice(0, 90)).setVisible(true)
    this.time.delayedCall(7000, () => a.burbuja.setVisible(false))
  }

  aplicarEstados() {
    for (const [id, a] of Object.entries(this.agentes)) {
      const e = this.estados[id] || {}
      const nuevo = e.estado || 'libre'
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
    const key = (x, y) => y * COLS + x
    const prev = new Map(); const q = [[sx, sy]]; prev.set(key(sx, sy), null)
    while (q.length) {
      const [x, y] = q.shift()
      if (x === tx && y === ty) {
        const out = []; let k = key(x, y)
        while (prev.get(k) !== null) { const [px, py] = prev.get(k); out.push({ x: k % COLS, y: Math.floor(k / COLS) }); k = key(px, py) }
        return out.reverse()
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= FILAS) continue
        const ok = this.walk[ny][nx] || (nx === tx && ny === ty)
        if (!ok || prev.has(key(nx, ny))) continue
        prev.set(key(nx, ny), [x, y]); q.push([nx, ny])
      }
    }
    return null
  }

  tileLibre(z) {
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(z.x0, z.x1), y = Phaser.Math.Between(z.y0, z.y1)
      if (this.walk[y]?.[x]) return { x, y }
    }
    return null
  }

  update(time, delta) {
    for (const a of Object.values(this.agentes)) {
      const spr = a.spr
      if (a.path.length) {
        const n = a.path[0], nx = n.x * T + 8, ny = n.y * T + 8
        const dx = nx - spr.x, dy = ny - spr.y, dist = Math.hypot(dx, dy), v = 42 * delta / 1000
        if (dist <= v) {
          spr.x = nx; spr.y = ny; a.tx = n.x; a.ty = n.y; a.path.shift()
          if (!a.path.length) { a.sentado = (a.tx === MESAS[a.id].x && a.ty === MESAS[a.id].y); spr.play(`pj-${a.id}-idle-${a.sentado ? 'up' : a.dir}`, true) }
        } else {
          spr.x += dx / dist * v; spr.y += dy / dist * v
          a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
          spr.play(`pj-${a.id}-walk-${a.dir}`, true)
        }
      } else {
        spr.x = a.tx * T + 8; spr.y = a.ty * T + 8
        a.timer += delta
        if (a.estado === 'libre' && a.id !== 'ceo' && a.timer > Phaser.Math.Between(6000, 14000)) {
          a.timer = 0; const r = Math.random(); let dest = null
          if (r < 0.25) dest = { x: LUGARES.cafetera.x, y: LUGARES.cafetera.y }
          else if (r < 0.45) dest = this.tileLibre(MESAS[a.id].despacho)
          else if (r < 0.6) dest = this.tileLibre({ x0: 23, x1: 28, y0: 12, y1: 16 })
          else if (r < 0.72) dest = this.tileLibre({ x0: 40, x1: 49, y0: 20, y1: 27 })
          else if (r < 0.82) dest = this.tileLibre({ x0: 15, x1: 25, y0: 2, y1: 8 })
          else dest = this.tileLibre(COMUN)
          if (dest) this.irA(a, dest.x, dest.y)
        }
        if (a.estado === 'trabajando' && !a.sentado) this.irA(a, MESAS[a.id].x, MESAS[a.id].y)
        // respiración / escribir
        if (a.estado === 'trabajando' && a.sentado) spr.y += Math.sin(time / 150) * 0.4
      }
      spr.setDepth(spr.y + 8)
      a.sombra.setPosition(spr.x, spr.y + 1).setDepth(spr.y + 7)
      a.etiqueta.setPosition(spr.x, spr.y - 22)
      a.burbuja.setPosition(spr.x, spr.y - 30)
    }
  }
}
