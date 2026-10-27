import Phaser from 'phaser'
import { T, TILES, PROPS, makeTexture, makePersonaje } from './pixel.js'

// Mapa 40x22 tiles. Leyenda:
//  # pared   = canto pared   g cristal   D puerta
//  . suelo madera   , moqueta   : baldosa   r alfombra
export const MAPA = [
  '########################################',
  '#......................#...............#',
  '#......................#...............#',
  '#......................#...............#',
  '#......................#...............#',
  '#......................#...............#',
  '#......................#...............#',
  '#......................#...............#',
  '#######D######D########ggggggDgggggggggg',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '########D###########D#######D###########',
  '#:::::::::::::::::::#..................#',
  '#:::::::::::::::::::#..................#',
  '#:::::::::::::::::::#..................#',
  '#:::::::::::::::::::#..................#',
  '#:::::::::::::::::::#..................#',
  '########################################',
]
export const COLS = MAPA[0].length, FILAS = MAPA.length
export const ANCHO = COLS * T, ALTO = FILAS * T

// Posiciones clave (en tiles)
export const LUGARES = {
  recepcion: { x: 10, y: 5 },
  cafetera: { x: 3, y: 10 },
  escuela: { x: 8, y: 18 },
  listo: { x: 30, y: 18 },
  salaReunion: { x: 20, y: 12 },
}

// Mesa de cada agente: x,y del tile de la silla (donde se sienta) y la mesa encima
export const MESAS = {
  jefe: { x: 31, y: 4, nombre: 'JEFE', despacho: 'DESPACHO DEL JEFE' },
  tiendas: { x: 8, y: 12, nombre: 'TIENDAS' },
  creador: { x: 19, y: 12, nombre: 'CREADOR' },
  editor: { x: 30, y: 12, nombre: 'EDITOR' },
}

export default class OficinaScene extends Phaser.Scene {
  constructor(bus) { super('oficina'); this.bus = bus; this.agentes = {}; this.estados = {}; this.monitores = {} }

  create() {
    const s = this
    // --- texturas ---
    Object.entries(TILES).forEach(([k, rows]) => makeTexture(s, 'tile-' + k, rows))
    Object.entries(PROPS).forEach(([k, rows]) => makeTexture(s, 'prop-' + k, rows))

    // --- suelo y paredes ---
    this.walk = []
    for (let y = 0; y < FILAS; y++) {
      this.walk[y] = []
      for (let x = 0; x < COLS; x++) {
        const c = MAPA[y][x]
        let tex = 'tile-suelo', walkable = true
        if (c === ',') tex = 'tile-moqueta'
        else if (c === ':') tex = 'tile-baldosa'
        else if (c === 'r') tex = 'tile-alfombra'
        else if (c === '#') { const abajo = MAPA[y + 1]?.[x]; tex = (abajo && abajo !== '#' && abajo !== 'g') ? 'tile-pared' : 'tile-muro'; walkable = false }
        else if (c === 'g') { tex = 'tile-cristal'; walkable = false }
        else if (c === 'D') { tex = 'tile-puerta'; walkable = true }
        s.add.image(x * T, y * T, tex).setOrigin(0).setDepth(0)
        this.walk[y][x] = walkable
      }
    }

    // --- mobiliario ---
    const prop = (k, tx, ty, depth) => s.add.image(tx * T, ty * T, 'prop-' + k).setOrigin(0).setDepth(depth ?? ty * T + 8)
    const bloquear = (tx, ty, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.walk[ty + j]) this.walk[ty + j][tx + i] = false }

    // Recepción
    prop('mostrador', 5, 5); bloquear(5, 5, 3, 1)
    prop('sofa', 1, 2); bloquear(1, 2, 2, 1)
    prop('planta', 3, 1); bloquear(3, 1)
    prop('planta', 21, 1); bloquear(21, 1)
    prop('cuadro', 8, 0, 1); prop('ventana', 14, 0, 1); prop('ventana', 17, 0, 1)
    prop('mesaRedonda', 15, 3); bloquear(15, 3, 2, 2)
    prop('silla', 14, 4); prop('silla', 17, 4); prop('silla', 15, 2); prop('silla', 16, 5)
    prop('dispensador', 22, 6); bloquear(22, 6)
    prop('cuadro', 4, 0, 1)
    this.rotulo(2 * T, 1 * T, 'RECEPCIÓN')

    // Despacho del Jefe (cristal)
    prop('ventana', 27, 0, 1); prop('ventana', 35, 0, 1); prop('cuadro', 31, 0, 1)
    prop('planta', 38, 1); bloquear(38, 1)
    prop('estanteria', 24, 1); bloquear(24, 1, 2, 2)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.add.image((29 + i) * T, (2 + j) * T, 'tile-alfombra').setOrigin(0).setDepth(0.2)
    prop('sofa', 35, 5); bloquear(35, 5, 2, 1)
    prop('planta', 26, 6); bloquear(26, 6)
    this.rotulo(26 * T, 1 * T, 'DESPACHO DEL JEFE')

    // Open space
    prop('cafetera', 3, 9); bloquear(3, 9)
    prop('planta', 1, 9); bloquear(1, 9)
    prop('planta', 38, 9); bloquear(38, 9)
    prop('planta', 38, 14); bloquear(38, 14)
    // mesas libres (futuros fichajes)
    prop('mesa', 12, 11); bloquear(12, 11, 2, 1); prop('monitorOff', 13, 10.6); prop('silla', 13, 12)
    prop('mesa', 23, 11); bloquear(23, 11, 2, 1); prop('monitorOff', 24, 10.6); prop('silla', 24, 12)
    prop('dispensador', 36, 9); bloquear(36, 9)
    prop('cuadro', 10, 8, 2); prop('cuadro', 33, 8, 2)
    this.rotulo(14 * T, 9 * T, 'EQUIPO')

    // Escuela
    prop('pizarra', 6, 16, 1); bloquear(6, 16, 3, 1)
    prop('mesa', 3, 18); bloquear(3, 18, 2, 1); prop('mesa', 8, 18); bloquear(8, 18, 2, 1); prop('mesa', 13, 18); bloquear(13, 18, 2, 1)
    prop('silla', 4, 19); prop('silla', 9, 19); prop('silla', 14, 19)
    prop('planta', 1, 20); bloquear(1, 20)
    prop('cuadro', 12, 15, 2); prop('planta', 17, 20); bloquear(17, 20)
    this.rotulo(1 * T, 16 * T, 'ESCUELA')

    // Sala LISTO
    prop('tele', 28, 16, 1); bloquear(28, 16, 2, 1)
    prop('estanteria', 22, 16); bloquear(22, 16, 2, 2)
    prop('estanteria', 36, 16); bloquear(36, 16, 2, 2)
    prop('sofa', 29, 19); bloquear(29, 19, 2, 1)
    prop('planta', 25, 20); bloquear(25, 20); prop('planta', 34, 20); bloquear(34, 20)
    prop('sofa', 32, 19); bloquear(32, 19, 2, 1)
    this.rotulo(22 * T + 2, 20 * T, 'LISTO PARA SUBIR')

    // Mesas de los agentes
    for (const [id, m] of Object.entries(MESAS)) {
      const mx = m.x - 1, my = m.y - 1
      prop('mesa', mx, my); bloquear(mx, my, 2, 1)
      this.monitores[id] = s.add.image(m.x * T, (my) * T - 6, 'prop-monitorOff').setOrigin(0).setDepth(my * T + 9)
      prop('teclado', m.x, my)
      prop('silla', m.x, m.y, m.y * T + 2)
    }
    // la silla es transitable (el agente se sienta ahí)

    // --- personajes ---
    const colores = { jefe: '#f5a623', tiendas: '#4a90e2', creador: '#bd10e0', editor: '#7ed321' }
    const pelos = { jefe: 'K', tiendas: 'b', creador: 'K', editor: 'o' }
    for (const [id, m] of Object.entries(MESAS)) {
      makePersonaje(s, 'pj-' + id, colores[id], pelos[id])
      const spr = s.add.sprite(m.x * T + 8, m.y * T + 8, 'pj-' + id, 'down0').setOrigin(0.5, 0.75).setDepth(m.y * T + 10)
      const etiqueta = s.add.text(0, 0, m.nombre, { fontFamily: 'monospace', fontSize: '7px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5, 1).setDepth(9999)
      const burbuja = s.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '7px', color: '#111', backgroundColor: '#fffbe6', padding: { x: 3, y: 2 }, wordWrap: { width: 90 } }).setOrigin(0.5, 1).setDepth(10000).setVisible(false)
      this.agentes[id] = { id, spr, etiqueta, burbuja, tx: m.x, ty: m.y, path: [], estado: 'libre', dir: 'down', sentado: true, timer: 0, tarea: '' }
    }

    // Parpadeo de monitores
    s.time.addEvent({ delay: 400, loop: true, callback: () => {
      for (const [id, mon] of Object.entries(this.monitores)) {
        const a = this.agentes[id]
        if (a.estado === 'trabajando' && a.sentado) mon.setTexture(mon.texture.key === 'prop-monitorOn' ? 'prop-monitorOn2' : 'prop-monitorOn')
        else mon.setTexture('prop-monitorOff')
      }
    } })

    // Clic sobre un agente -> avisar a React
    for (const a of Object.values(this.agentes)) {
      a.spr.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.bus.emit('click-agente', a.id))
    }

    // Estado desde fuera
    this.bus.on('estado', (estados) => { this.estados = estados; this.aplicarEstados() })
    this.bus.on('bocadillo', ({ id, texto }) => this.bocadillo(id, texto))
    this.aplicarEstados()
    s.cameras.main.setBackgroundColor('#0f1116')
  }

  rotulo(x, y, texto) {
    this.add.text(x + 3, y + 3, texto, { fontFamily: 'monospace', fontSize: '8px', color: '#ffe9a8', backgroundColor: '#00000066', padding: { x: 2, y: 1 } }).setDepth(5000)
  }
  placa(x, y, texto) {
    this.add.image(x, y, 'prop-letrero').setOrigin(0).setDepth(y + 20)
    this.add.text(x + 7, y + 3, texto.slice(0, 7), { fontFamily: 'monospace', fontSize: '5px', color: '#1b1b24', fontStyle: 'bold' }).setOrigin(0.5).setDepth(y + 21)
  }

  bocadillo(id, texto) {
    const a = this.agentes[id]; if (!a) return
    a.burbuja.setText(texto.slice(0, 70)).setVisible(true)
    this.time.delayedCall(6000, () => a.burbuja.setVisible(false))
  }

  aplicarEstados() {
    for (const [id, a] of Object.entries(this.agentes)) {
      const e = this.estados[id] || {}
      const nuevo = e.estado || 'libre'
      if (nuevo !== a.estado) {
        a.estado = nuevo
        if (nuevo === 'trabajando') { this.irA(a, MESAS[id].x, MESAS[id].y); this.bocadillo(id, e.tarea ? '💻 ' + e.tarea : '💻 Trabajando…') }
        else if (nuevo === 'esperando') this.irA(a, LUGARES.recepcion.x + Object.keys(this.agentes).indexOf(id) * 2, LUGARES.recepcion.y + 2)
        else a.timer = 0
      }
      a.tarea = e.tarea || ''
    }
  }

  // ---------- movimiento ----------
  irA(a, tx, ty) {
    const path = this.bfs(a.tx, a.ty, tx, ty)
    if (path) { a.path = path; a.sentado = false }
  }

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

  tileLibreAleatorio(zona) {
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(zona.x0, zona.x1), y = Phaser.Math.Between(zona.y0, zona.y1)
      if (this.walk[y]?.[x]) return { x, y }
    }
    return null
  }

  update(time, delta) {
    for (const a of Object.values(this.agentes)) {
      const spr = a.spr
      const destX = a.tx * T + 8, destY = a.ty * T + 8
      if (a.path.length) {
        const n = a.path[0]
        const nx = n.x * T + 8, ny = n.y * T + 8
        const dx = nx - spr.x, dy = ny - spr.y
        const dist = Math.hypot(dx, dy), v = 40 * delta / 1000
        if (dist <= v) { spr.x = nx; spr.y = ny; a.tx = n.x; a.ty = n.y; a.path.shift(); if (!a.path.length) { a.sentado = (a.tx === MESAS[a.id].x && a.ty === MESAS[a.id].y); spr.play(`pj-${a.id}-idle-${a.sentado ? 'up' : a.dir}`, true) } }
        else {
          spr.x += dx / dist * v; spr.y += dy / dist * v
          a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
          spr.play(`pj-${a.id}-walk-${a.dir}`, true)
        }
      } else {
        spr.x = destX; spr.y = destY
        // comportamiento ocioso
        a.timer += delta
        if (a.estado === 'libre' && a.timer > Phaser.Math.Between(5000, 12000)) {
          a.timer = 0
          const r = Math.random()
          let dest = null
          if (r < 0.3) dest = { x: LUGARES.cafetera.x + 1, y: LUGARES.cafetera.y }
          else if (r < 0.45) dest = { x: MESAS[a.id].x, y: MESAS[a.id].y }
          else if (r < 0.6 && a.id !== 'jefe') dest = this.tileLibreAleatorio({ x0: 2, x1: 17, y0: 17, y1: 20 })
          else if (r < 0.75) dest = this.tileLibreAleatorio({ x0: 22, x1: 37, y0: 17, y1: 20 })
          else dest = this.tileLibreAleatorio(a.id === 'jefe' ? { x0: 25, x1: 37, y0: 2, y1: 6 } : { x0: 2, x1: 37, y0: 10, y1: 13 })
          if (dest) this.irA(a, dest.x, dest.y)
        }
        if (a.estado === 'trabajando' && !a.sentado && !a.path.length) this.irA(a, MESAS[a.id].x, MESAS[a.id].y)
      }
      spr.setDepth(spr.y + 8)
      a.etiqueta.setPosition(spr.x, spr.y - 20)
      a.burbuja.setPosition(spr.x, spr.y - 26)
    }
  }
}
