// Generador de personajes pixel art (16x24) a partir de una "apariencia".
// Opciones que puede elegir Iván en la web:
export const OPCIONES = {
  piel: { clara: '#f1c9a5', media: '#d9a06c', morena: '#b07a4a', oscura: '#6f4a2e' },
  pelo_color: { negro: '#1b1b24', castano: '#5a3a1e', rubio: '#d9b45a', pelirrojo: '#b4481f', gris: '#9a9aa6', azul: '#3b6fd8', rosa: '#e06aa8', verde: '#3f9b5c' },
  pelo: { corto: 'Corto', largo: 'Largo', rizado: 'Rizado', rapado: 'Rapado', mono: 'Moño', flequillo: 'Flequillo', calvo: 'Sin pelo' },
  ropa: { camiseta: 'Camiseta', sudadera: 'Sudadera', camisa: 'Camisa', traje: 'Traje', chaleco: 'Chaleco', bata: 'Bata' },
  accesorio: { ninguno: 'Nada', gafas: 'Gafas', gorra: 'Gorra', auriculares: 'Auriculares', gafas_sol: 'Gafas de sol' },
}
export const APARIENCIA_DEFECTO = { piel: 'clara', pelo: 'corto', pelo_color: 'negro', ropa: 'camiseta', ropa_color: '#4a90e2', accesorio: 'ninguno' }

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgb2hex([r, g, b]) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('') }
export function sombra(h, f = 0.72) { return rgb2hex(hex2rgb(h).map(v => v * f)) }
export function luz(h, f = 1.18) { return rgb2hex(hex2rgb(h).map(v => Math.min(255, v * f))) }

// Dibuja un frame (dir, frame de andar) en un contexto canvas en (ox, oy). Escala 1px = 1px.
export function dibujarPersonaje(ctx, ap, dir, frame, ox, oy) {
  const a = { ...APARIENCIA_DEFECTO, ...ap }
  const piel = OPCIONES.piel[a.piel] || OPCIONES.piel.clara, pielS = sombra(piel)
  const pelo = OPCIONES.pelo_color[a.pelo_color] || OPCIONES.pelo_color.negro, peloS = sombra(pelo, 0.8)
  const ropa = a.ropa_color || '#4a90e2', ropaS = sombra(ropa), ropaL = luz(ropa)
  const K = '#1b1b24', W = '#f4f1ea', pant = '#2b2f3f', pantS = '#1d2030', zap = '#141418'
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h) }
  const izq = dir === 'left', der = dir === 'right', arriba = dir === 'up', abajo = dir === 'down'

  // --- piernas (frame 0 quieto, 1 y 2 pasos) ---
  const l = frame === 1 ? -1 : frame === 2 ? 1 : 0
  if (izq || der) {
    px(6, 17, pant, 2, 5); px(8, 17, pantS, 2, 5)
    if (l) { px(5 + (l > 0 ? 2 : 0), 20, pant, 2, 2); px(9 - (l > 0 ? 2 : 0), 20, pantS, 2, 2) }
    px(6, 22, zap, 2, 2); px(8, 22, zap, 2, 2)
  } else {
    px(5, 17, pant, 3, 5 + (l < 0 ? -1 : 0)); px(8, 17, pantS, 3, 5 + (l > 0 ? -1 : 0))
    px(5, 22 + (l < 0 ? -1 : 0), zap, 3, 2); px(8, 22 + (l > 0 ? -1 : 0), zap, 3, 2)
  }
  // --- cuerpo / ropa ---
  px(4, 10, ropa, 8, 7); px(4, 10, ropaS, 1, 7); px(11, 10, ropaS, 1, 7)
  if (a.ropa === 'sudadera') { px(5, 10, ropaL, 6, 1); px(7, 12, ropaS, 2, 4); px(4, 9, ropaS, 8, 1) }
  if (a.ropa === 'camisa') { px(7, 10, W, 2, 6); px(7, 10, ropaS, 1, 1); px(8, 10, ropaS, 1, 1); px(7, 11, K, 1, 1); px(8, 13, K, 1, 1) }
  if (a.ropa === 'traje') { px(4, 10, '#2a2a38', 8, 7); px(4, 10, '#1f1f2a', 1, 7); px(11, 10, '#1f1f2a', 1, 7); px(7, 10, W, 2, 5); px(7, 11, ropa, 2, 4) }
  if (a.ropa === 'chaleco') { px(5, 10, '#3a3a4a', 2, 7); px(9, 10, '#3a3a4a', 2, 7); px(7, 10, ropa, 2, 7) }
  if (a.ropa === 'bata') { px(4, 10, W, 8, 8); px(4, 10, '#d9d4c7', 1, 8); px(11, 10, '#d9d4c7', 1, 8); px(7, 10, ropa, 2, 8) }
  // brazos
  const bz = izq || der ? 0 : (l ? l : 0)
  px(3, 11 + (bz > 0 ? 1 : 0), ropaS, 1, 4); px(12, 11 + (bz < 0 ? 1 : 0), ropaS, 1, 4)
  px(3, 15 + (bz > 0 ? 1 : 0), piel, 1, 1); px(12, 15 + (bz < 0 ? 1 : 0), piel, 1, 1)
  // --- cabeza ---
  px(5, 3, piel, 6, 7); px(5, 9, pielS, 6, 1)
  px(4, 4, piel, 1, 4); px(11, 4, piel, 1, 4)
  // cara
  if (abajo) { px(6, 6, K, 1, 1); px(9, 6, K, 1, 1); px(7, 8, pielS, 2, 1) }
  if (izq) { px(5, 6, K, 1, 1); px(5, 8, pielS, 1, 1) }
  if (der) { px(10, 6, K, 1, 1); px(10, 8, pielS, 1, 1) }
  // --- pelo ---
  const estilo = a.pelo
  if (estilo !== 'calvo') {
    px(4, 2, pelo, 8, 2); px(5, 1, pelo, 6, 1)
    if (arriba) px(4, 2, pelo, 8, 7)
    if (estilo === 'corto') { px(4, 4, pelo, 1, 2); px(11, 4, pelo, 1, 2); if (!arriba) px(5, 4, peloS, 6, 0) }
    if (estilo === 'flequillo') { px(4, 4, pelo, 1, 2); px(11, 4, pelo, 1, 2); if (abajo) { px(5, 4, pelo, 3, 1); px(9, 4, pelo, 2, 1) } }
    if (estilo === 'largo') { px(4, 4, pelo, 1, 7); px(11, 4, pelo, 1, 7); px(3, 6, pelo, 1, 5); px(12, 6, pelo, 1, 5); if (arriba) px(4, 4, pelo, 8, 8) }
    if (estilo === 'rizado') { px(3, 2, pelo, 10, 3); px(3, 1, peloS, 1, 1); px(12, 1, peloS, 1, 1); px(4, 0, pelo, 8, 1); px(3, 4, pelo, 1, 3); px(12, 4, pelo, 1, 3); px(5, 0, peloS, 2, 1); px(9, 0, peloS, 2, 1) }
    if (estilo === 'rapado') { ctx.globalAlpha = 0.55; px(4, 2, pelo, 8, 2); px(5, 1, pelo, 6, 1); ctx.globalAlpha = 1 }
    if (estilo === 'mono') { px(4, 4, pelo, 1, 2); px(11, 4, pelo, 1, 2); px(6, 0, pelo, 4, 2); px(7, -1, peloS, 2, 1) }
  }
  // --- accesorios ---
  if (a.accesorio === 'gafas' && !arriba) { if (abajo) { px(5, 6, '#2a2a38', 3, 1); px(8, 6, '#2a2a38', 3, 1); px(6, 6, '#9fd0ff', 1, 1); px(9, 6, '#9fd0ff', 1, 1) } else { px(izq ? 4 : 9, 6, '#2a2a38', 3, 1) } }
  if (a.accesorio === 'gafas_sol' && !arriba) { if (abajo) { px(5, 6, K, 3, 1); px(8, 6, K, 3, 1) } else px(izq ? 4 : 9, 6, K, 3, 1) }
  if (a.accesorio === 'gorra') { px(4, 1, ropa, 8, 3); px(5, 0, ropaS, 6, 1); if (abajo) px(3, 3, ropaS, 10, 1); if (izq) px(2, 3, ropaS, 4, 1); if (der) px(10, 3, ropaS, 4, 1) }
  if (a.accesorio === 'auriculares') { px(4, 1, '#2a2a38', 8, 1); px(3, 4, '#2a2a38', 2, 3); px(11, 4, '#2a2a38', 2, 3); px(3, 5, '#4ea3ff', 1, 1); px(12, 5, '#4ea3ff', 1, 1) }
}

// Crea/regenera la textura y animaciones de un agente en Phaser
export function registrarPersonaje(scene, key, apariencia) {
  const dirs = ['down', 'left', 'right', 'up']
  if (scene.textures.exists(key)) {
    for (const d of dirs) { scene.anims.remove(`${key}-walk-${d}`); scene.anims.remove(`${key}-idle-${d}`) }
    scene.textures.remove(key)
  }
  const tex = scene.textures.createCanvas(key, 16 * 12 + 24, 26)
  let i = 0
  for (const d of dirs) for (let f = 0; f < 3; f++) { dibujarPersonaje(tex.context, apariencia, d, f, i * 16 + 1, 1); i++ }
  tex.refresh()
  i = 0
  for (const d of dirs) for (let f = 0; f < 3; f++) { tex.add(`${d}${f}`, 0, i * 16, 0, 16, 26); i++ }
  for (const d of dirs) {
    scene.anims.create({ key: `${key}-walk-${d}`, frames: [0, 1, 0, 2].map(f => ({ key, frame: `${d}${f}` })), frameRate: 7, repeat: -1 })
    scene.anims.create({ key: `${key}-idle-${d}`, frames: [{ key, frame: `${d}0` }], frameRate: 1 })
  }
}

// Vista previa para la web (canvas HTML), escala 6
export function previsualizar(canvas, apariencia, dir = 'down') {
  const ctx = canvas.getContext('2d'); const S = 6
  canvas.width = 16 * S; canvas.height = 26 * S
  ctx.imageSmoothingEnabled = false
  const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 26
  dibujarPersonaje(tmp.getContext('2d'), apariencia, dir, 0, 0, 1)
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(tmp, 0, 0, 16, 26, 0, 0, 16 * S, 26 * S)
}
