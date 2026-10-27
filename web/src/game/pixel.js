// Fábrica de sprites pixel art dibujados por código (sin archivos externos).
// Cada sprite es un array de strings; cada carácter es un color de la paleta.
export const T = 16 // tamaño de tile

const PAL = {
  '.': null,
  'k': '#1b1b24', 'K': '#2a2a38', // negros
  'w': '#f4f1ea', 'W': '#d9d4c7', // blancos
  'g': '#8a8f9c', 'G': '#5c6170', 'h': '#b8bcc6', // grises
  'b': '#6b4a2b', 'B': '#4a3119', 'c': '#8c6a44', 'C': '#a9845a', // maderas
  'f': '#cfc2a6', 'F': '#c2b391', // suelo madera claro
  'm': '#3b5f8a', 'M': '#2b4466', // azules
  'n': '#4ea3ff', 'N': '#9fd0ff', // pantalla encendida
  'p': '#3e8f4a', 'P': '#2d6b36', 'q': '#6cc26e', // plantas
  'r': '#b23b3b', 'R': '#7d2626', // rojos
  'y': '#e8c547', 'Y': '#b2922b', // amarillos
  'o': '#e07b39', 'O': '#a85a24', // naranja
  's': '#f1c9a5', 'S': '#d9a77e', // piel
  'v': '#5e3f7a', 'V': '#3d2752', // morado
  't': '#2f7d7a', 'u': '#9ad7d4', // teal / cristal
  'e': '#3b3b4a', 'E': '#51516a', // moqueta
  'z': '#d35b7a', 'Z': '#9b3550', // rosa
  'a': '#7a5c3a', 'A': '#5a4228', // ladrillo
}

export function drawSprite(ctx, rows, x = 0, y = 0, pal = PAL, scale = 1) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale)
    }
  }
}

export function makeTexture(scene, key, rows, pal = PAL) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length
  if (scene.textures.exists(key)) return key
  const tex = scene.textures.createCanvas(key, w, h)
  drawSprite(tex.context, rows, 0, 0, pal)
  tex.refresh()
  return key
}

// ---------- TILES (16x16) ----------
export const TILES = {
  suelo: [
    'ffffffffFfffffff', 'ffffffffFfffffff', 'ffffffffFfffffff', 'ffffffffFfffffff',
    'ffffffffFfffffff', 'ffffffffFfffffff', 'ffffffffFfffffff', 'FFFFFFFFFFFFFFFF',
    'ffffFfffffffffff', 'ffffFfffffffffff', 'ffffFfffffffffff', 'ffffFfffffffffff',
    'ffffFfffffffffff', 'ffffFfffffffffff', 'ffffFfffffffffff', 'FFFFFFFFFFFFFFFF',
  ],
  moqueta: [
    'eeeeeeeeeeeeeeee', 'eEeeeeeeEeeeeeee', 'eeeeeeeeeeeeeeee', 'eeeeeEeeeeeeeEee',
    'eeeeeeeeeeeeeeee', 'eeEeeeeeeeEeeeee', 'eeeeeeeeeeeeeeee', 'eeeeeeeEeeeeeeee',
    'eeeeeeeeeeeeeeee', 'eEeeeeeeeeeeEeee', 'eeeeeeeeeeeeeeee', 'eeeeEeeeeeeeeeee',
    'eeeeeeeeeeeeeeee', 'eeeeeeeeEeeeeeEe', 'eeeeeeeeeeeeeeee', 'eeeeeeeeeeeeeeee',
  ],
  baldosa: [
    'hhhhhhhhhhhhhhhh', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW',
    'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW',
    'hhhhhhhhhhhhhhhh', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW',
    'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW', 'hWWWWWWWhWWWWWWW',
  ],
  pared: [ // pared vista de frente (con zócalo)
    'KKKKKKKKKKKKKKKK', 'aAaaaaaAaaaaaAaa', 'aaaaaaaaaaaaaaaa', 'aaaAaaaaaaAaaaaa',
    'AaaaaaaAaaaaaaaA', 'aaaaaaaaaaaaaaaa', 'aaaaaAaaaaaaaAaa', 'aaaaaaaaaaaaaaaa',
    'aAaaaaaaaAaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaAaaaaaaaaA', 'aaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbb', 'BBBBBBBBBBBBBBBB', 'bbbbbbbbbbbbbbbb', 'KKKKKKKKKKKKKKKK',
  ],
  paredTop: [ // canto superior de pared
    'KKKKKKKKKKKKKKKK', 'GGGGGGGGGGGGGGGG', 'hhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhh',
    'GGGGGGGGGGGGGGGG', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK', 'KKKKKKKKKKKKKKKK',
  ],
  muro: [ // pared vista desde arriba (sólida)
    'EEEEEEEEEEEEEEEE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE',
    'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE',
    'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE',
    'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EKKKKKKKKKKKKKKE', 'EEEEEEEEEEEEEEEE',
  ],
  alfombraAzul: [
    'MMMMMMMMMMMMMMMM', 'MmmmmmmmmmmmmmmM', 'MmmmmmmmmmmmmmmM', 'MmmmmmmmMmmmmmmM',
    'MmmmmmmmmmmmmmmM', 'MmmmMmmmmmmmmmmM', 'MmmmmmmmmmmmmmmM', 'MmmmmmmmmmmmMmmM',
    'MmmmmmmmmmmmmmmM', 'MmmMmmmmmmmmmmmM', 'MmmmmmmmmmmmmmmM', 'MmmmmmmmmmMmmmmM',
    'MmmmmmmmmmmmmmmM', 'MmmmmmmMmmmmmmmM', 'MmmmmmmmmmmmmmmM', 'MMMMMMMMMMMMMMMM',
  ],
  alfombraVerde: [
    'PPPPPPPPPPPPPPPP', 'PppppppppppppppP', 'PppppppppppppppP', 'PppppppppPpppppP',
    'PppppppppppppppP', 'PppppPpppppppppP', 'PppppppppppppppP', 'PpppppppppppPppP',
    'PppppppppppppppP', 'PppPpppppppppppP', 'PppppppppppppppP', 'PppppppppppPpppP',
    'PppppppppppppppP', 'PppppppPpppppppP', 'PppppppppppppppP', 'PPPPPPPPPPPPPPPP',
  ],
  cristal: [ // mampara de cristal
    'KKKKKKKKKKKKKKKK', 'GuuuuuuuGuuuuuuG', 'GuuuuuuuGuuuuuuG', 'GuuuNuuuGuuuNuuG',
    'GuuuNuuuGuuuNuuG', 'GuuuuuuuGuuuuuuG', 'GuuuuuuuGuuuuuuG', 'GGGGGGGGGGGGGGGG',
    'GuuuuuuuGuuuuuuG', 'GuuuuuuuGuuuuuuG', 'GuuuNuuuGuuuNuuG', 'GuuuuuuuGuuuuuuG',
    'GuuuuuuuGuuuuuuG', 'GGGGGGGGGGGGGGGG', 'bbbbbbbbbbbbbbbb', 'KKKKKKKKKKKKKKKK',
  ],
  puerta: [
    'KKKKKKKKKKKKKKKK', 'KbbbbbbbbbbbbbbK', 'KbccccccccccccbK', 'KbcbbbbbbbbbbcbK',
    'KbcbccccccccbcbK', 'KbcbccccccccbcbK', 'KbcbccccccccbcbK', 'KbcbbbbbbbbbbcbK',
    'KbccccccccccccbK', 'KbcccccccccyycbK', 'KbcbbbbbbbbbbcbK', 'KbcbccccccccbcbK',
    'KbcbccccccccbcbK', 'KbcbbbbbbbbbbcbK', 'KbbbbbbbbbbbbbbK', 'KKKKKKKKKKKKKKKK',
  ],
  alfombra: [
    'rrrrrrrrrrrrrrrr', 'rRrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrRrrrrrrr',
    'rrrrrrrrrrrrrrrr', 'rrrrRrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrRrrr',
    'rrrrrrrrrrrrrrrr', 'rrRrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrRrrrrr',
    'rrrrrrrrrrrrrrrr', 'rrrrrrRrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrRr',
  ],
}

// ---------- MUEBLES ----------
export const PROPS = {
  mesa: [ // 32x16 escritorio (2 tiles ancho)
    '................................',
    '................................',
    '................................',
    '................................',
    '.CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.',
    'CccccccccccccccccccccccccccccccC',
    'CccccccccccccccccccccccccccccccC',
    'CccccccccccccccccccccccccccccccC',
    'CccccccccccccccccccccccccccccccC',
    'CccccccccccccccccccccccccccccccC',
    'CbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbC',
    '.BB..........................BB.',
    '.BB..........................BB.',
    '.BB..........................BB.',
    '.BB..........................BB.',
    '................................',
  ],
  monitorOff: [
    '................', '....KKKKKKKK....', '...KkkkkkkkkK...', '...KkkkkkkkkK...',
    '...KkkkkkkkkK...', '...KkkkkkkkkK...', '...KkkkkkkkkK...', '....KKKKKKKK....',
    '.......GG.......', '.......GG.......', '.....GGGGGG.....', '................',
    '................', '................', '................', '................',
  ],
  monitorOn: [
    '................', '....KKKKKKKK....', '...KnnnnnnnnK...', '...KnNNNnnnnK...',
    '...KnnnnnNnnK...', '...KnNNnnnnnK...', '...KnnnnnnnnK...', '....KKKKKKKK....',
    '.......GG.......', '.......GG.......', '.....GGGGGG.....', '................',
    '................', '................', '................', '................',
  ],
  monitorOn2: [
    '................', '....KKKKKKKK....', '...KnnnnnnnnK...', '...KnnnNNNnnK...',
    '...KnNnnnnnnK...', '...KnnnnNNnnK...', '...KnnNnnnnnK...', '....KKKKKKKK....',
    '.......GG.......', '.......GG.......', '.....GGGGGG.....', '................',
    '................', '................', '................', '................',
  ],
  teclado: [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................', '................', '................', '...GGGGGGGGGG...',
    '...GhhhhhhhhG...', '...GGGGGGGGGG...', '................', '................',
  ],
  silla: [
    '................', '................', '................', '.....KKKKKK.....',
    '....KEEEEEEK....', '....KEEEEEEK....', '....KEEEEEEK....', '....KEEEEEEK....',
    '.....KKKKKK.....', '......KKKK......', '.....KEEEEK.....', '.....KKKKKK.....',
    '.......KK.......', '......KKKK......', '.....K....K.....', '................',
  ],
  planta: [
    '................', '......qq........', '....qqppqq......', '...qpPppppq.....',
    '..qppPPpppPq....', '..qpppPppppq....', '...qppppppq.....', '....qppPpq......',
    '......pp........', '.....OooO.......', '.....OooO.......', '.....OooO.......',
    '....OOOOOO......', '....OooooO......', '....OOOOOO......', '................',
  ],
  cafetera: [
    '................', '....KKKKKKKK....', '...KGGGGGGGGK...', '...KGrrrrrrGK...',
    '...KGGGGGGGGK...', '...KKKKKKKKKK...', '...KhhhhhhhhK...', '....KhKKKKhK....',
    '....Kh....hK....', '....Kh.ww.hK....', '....Kh.WW.hK....', '...KKKKKKKKKK...',
    '...KGGGGGGGGK...', '...KKKKKKKKKK...', '................', '................',
  ],
  pizarra: [ // 48x16 (3 tiles)
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bPPwwwwPPPwwwwwwPPPwwwPPPPPPwwPPwwwwPPPPPPPPPPPPb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bPPwwPPPwwwwPPPwwPPPPwwwwwwPPPwwPPPwwwwwwPPPPPPb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bPPwwwwwwPPwwPPPPwwwwPPPwwwwPPPPPPwwPPPPPPPPPPPb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bbbbbbwwbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
  ],
  estanteria: [ // 32x32
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bccccccccccccccccccccccccccccccb',
    'bcrrmmyyvvttrrmmyyvvttrrmmyyvvcb',
    'bcrrmmyyvvttrrmmyyvvttrrmmyyvvcb',
    'bcrrmmyyvvttrrmmyyvvttrrmmyyvvcb',
    'bcrrmmyyvvttrrmmyyvvttrrmmyyvvcb',
    'bccccccccccccccccccccccccccccccb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bccccccccccccccccccccccccccccccb',
    'bcttvvrrmmyyttvvrrmmyyttvvrrmmcb',
    'bcttvvrrmmyyttvvrrmmyyttvvrrmmcb',
    'bcttvvrrmmyyttvvrrmmyyttvvrrmmcb',
    'bcttvvrrmmyyttvvrrmmyyttvvrrmmcb',
    'bccccccccccccccccccccccccccccccb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bccccccccccccccccccccccccccccccb',
    'bcyyvvttrrmmyyvvttrrmmyyvvttrrcb',
    'bcyyvvttrrmmyyvvttrrmmyyvvttrrcb',
    'bcyyvvttrrmmyyvvttrrmmyyvvttrrcb',
    'bcyyvvttrrmmyyvvttrrmmyyvvttrrcb',
    'bccccccccccccccccccccccccccccccb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bccccccccccccccccccccccccccccccb',
    'bcmmrryyvvttmmrryyvvttmmrryyvvcb',
    'bcmmrryyvvttmmrryyvvttmmrryyvvcb',
    'bcmmrryyvvttmmrryyvvttmmrryyvvcb',
    'bcmmrryyvvttmmrryyvvttmmrryyvvcb',
    'bccccccccccccccccccccccccccccccb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '................................',
    '................................',
  ],
  sofa: [ // 32x16
    '................................',
    '................................',
    '................................',
    '................................',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvVVVVVVVVVVVVVVVVVVVVVVVVVVVVvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    '.KK..........................KK.',
    '................................',
    '................................',
  ],
  mostrador: [ // 48x16 recepción
    '................................................',
    '................................................',
    '................................................',
    'tttttttttttttttttttttttttttttttttttttttttttttttt',
    'tuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuut',
    'tuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuut',
    'tttttttttttttttttttttttttttttttttttttttttttttttt',
    'MmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmM',
    'MmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmM',
    'MmmmmmmmmyyyyyyyyyyyyyyyyyyyyyyyyyyyyyymmmmmmmmM',
    'MmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmM',
    'MmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmM',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    '................................................',
    '................................................',
    '................................................',
  ],
  cuadro: [
    '................', '..bbbbbbbbbbbb..', '..bmmmmmmmmmmb..', '..bmmNNmmmmmmb..',
    '..bmmmmmmyymmb..', '..bmmpppmmmmmb..', '..bmppppppmmmb..', '..bpppppppppmb..',
    '..bbbbbbbbbbbb..', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  ventana: [
    '................', '.KKKKKKKKKKKKKK.', '.KuuuuuuKuuuuuK.', '.KuuNuuuKuuuNuK.',
    '.KuuuuuuKuuuuuK.', '.KuuuuuuKuuuuuK.', '.KKKKKKKKKKKKKK.', '.KuuuuuuKuuuuuK.',
    '.KuuuuuuKuuuuuK.', '.KuuuNuuKuuNuuK.', '.KuuuuuuKuuuuuK.', '.KKKKKKKKKKKKKK.',
    '................', '................', '................', '................',
  ],
  letrero: [ // placa de mesa 14x6
    'KKKKKKKKKKKKKK',
    'KyyyyyyyyyyyyK',
    'KyyyyyyyyyyyyK',
    'KyyyyyyyyyyyyK',
    'KyyyyyyyyyyyyK',
    'KKKKKKKKKKKKKK',
  ],
  dispensador: [ // fuente de agua
    '................', '.....KKKKKK.....', '....KuuuuuuK....', '....KuuNuuuK....',
    '....KuuuuuuK....', '....KuuuuuuK....', '....KuuuuuuK....', '.....KKKKKK.....',
    '.....GGGGGG.....', '.....GhhhhG.....', '.....GGGGGG.....', '.....GGGGGG.....',
    '.....GGGGGG.....', '.....GGGGGG.....', '....GGGGGGGG....', '................',
  ],
  mesaRedonda: [ // 32x32 mesa de reuniones
    '................................',
    '................................',
    '..........CCCCCCCCCCCC..........',
    '.......CCCccccccccccccCCC.......',
    '.....CCccccccccccccccccccCC.....',
    '....CcccccccccccccccccccccC.....',
    '...CcccccccccccccccccccccccC....',
    '...CcccccccccccccccccccccccC....',
    '..CcccccccccccccccccccccccccC...',
    '..CcccccccccccccccccccccccccC...',
    '..CcccccccccccccccccccccccccC...',
    '..CcccccccccccccccccccccccccC...',
    '..CcccccccccccccccccccccccccC...',
    '..CcccccccccccccccccccccccccC...',
    '...CcccccccccccccccccccccccC....',
    '...CcccccccccccccccccccccccC....',
    '....CcccccccccccccccccccccC.....',
    '.....CCccccccccccccccccccCC.....',
    '.......CCCccccccccccccCCC.......',
    '..........CCCCCCCCCCCC..........',
    '............BBBBBBBB............',
    '............BBBBBBBB............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  impresora: [
    '................', '................', '................', '....GGGGGGGG....',
    '...GhhhhhhhhG...', '...GGGGGGGGGG...', '..GhhhhhhhhhhG..', '..GhKKKKKKKKhG..',
    '..GhhhhhhhhhhG..', '..GGGGGGGGGGGG..', '..GhhhhhhhhhhG..', '..GGGGGGGGGGGG..',
    '................', '................', '................', '................',
  ],
  archivador: [
    '................', '....GGGGGGGG....', '...GhhhhhhhhG...', '...GhhhKKhhhG...',
    '...GGGGGGGGGG...', '...GhhhhhhhhG...', '...GhhhKKhhhG...', '...GGGGGGGGGG...',
    '...GhhhhhhhhG...', '...GhhhKKhhhG...', '...GGGGGGGGGG...', '...GhhhhhhhhG...',
    '...GhhhKKhhhG...', '...GGGGGGGGGG...', '................', '................',
  ],
  mesita: [
    '................', '................', '................', '................',
    '....CCCCCCCC....', '...CccccccccC...', '...CccccccccC...', '...CbbbbbbbbC...',
    '....B......B....', '....B......B....', '................', '................',
    '................', '................', '................', '................',
  ],
  tele: [ // 32x16 pantalla grande sala Listo
    '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
    'KkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkK',
    'KknnnnnnnnnnnnnnnnnnnnnnnnnnnnkK',
    'KknNNNnnnnnnnNNnnnnnnnnnNNNnnnkK',
    'KknnnnnnnnnnnnnnnnnnnnnnnnnnnnkK',
    'KknnnnnNNNnnnnnnnnNNNNnnnnnnnnkK',
    'KknnnnnnnnnnnnnnnnnnnnnnnnnnnnkK',
    'KknnnnnnnnnnnnnnnnnnnnnnnnnnnnkK',
    'KknnnnnnnnnnnnnnnnnnnnnnnnnnnnkK',
    'KkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkK',
    '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
    '...............GG...............',
    '............GGGGGGGG............',
    '................................',
    '................................',
    '................................',
  ],
}

// ---------- PERSONAJES (16x24), 4 direcciones x 3 frames ----------
// Plantilla con el color del cuerpo 'X' y pelo 'H'; piernas se desplazan por frame.
function personaje(dir, frame, pelo = 'B') {
  // dir: 'down' | 'up' | 'left' | 'right'
  const H = pelo
  const cara = dir === 'up' ? ['..' + H + H + H + H + H + H + H + H + '..', '.' + H + H + H + H + H + H + H + H + H + H + '.', '.' + H + H + H + H + H + H + H + H + H + H + '.', '.' + H + H + H + H + H + H + H + H + H + H + '.', '..' + H + H + H + H + H + H + H + H + '..', '...ssssss...']
    : dir === 'down' ? ['..' + H + H + H + H + H + H + H + H + '..', '.' + H + H + H + H + H + H + H + H + H + H + '.', '.' + H + 'ssssssss' + H + '.', '.' + H + 'sskssks' + 's' + H + '.', '..ssssssss..', '...ssssss...']
    : dir === 'left' ? ['..' + H + H + H + H + H + H + H + H + '..', '.' + H + H + H + H + H + H + H + H + H + H + '.', '.' + H + H + H + 'sssss' + H + H + '.', '.' + H + H + 'sksssss' + H + H + '.', '..ssssssss..', '...ssssss...']
    : ['..' + H + H + H + H + H + H + H + H + '..', '.' + H + H + H + H + H + H + H + H + H + H + '.', '.' + H + H + 'sssss' + H + H + H + '.', '.' + H + H + 'ssssskss' + H + H + '.', '..ssssssss..', '...ssssss...']
  const cuerpo = ['..XXXXXXXX..', '.XXXXXXXXXX.', 'sXXXXXXXXXXs', 'sXXXXXXXXXXs', '.XXXXXXXXXX.', '..XXXXXXXX..', '..KKKKKKKK..']
  const piernas = frame === 0 ? ['..KKK..KKK..', '..KKK..KKK..', '..KKK..KKK..', '..kkk..kkk..']
    : frame === 1 ? ['..KKK..KKK..', '.KKK....KKK.', '.KKK....KKK.', '.kkk....kkk.']
    : ['..KKK..KKK..', '...KKKKKK...', '..KKK..KKK..', '..kkk..kkk..']
  const rows = [...cara, ...cuerpo, ...piernas].map(r => '..' + r + '..') // 16 ancho
  while (rows.length < 24) rows.push('................')
  return rows
}

export function makePersonaje(scene, key, colorHex, pelo = 'B') {
  if (scene.textures.exists(key)) return
  const dirs = ['down', 'left', 'right', 'up']
  const tex = scene.textures.createCanvas(key, 16 * 12, 24)
  const pal = { ...PAL, X: colorHex }
  let i = 0
  for (const d of dirs) for (let f = 0; f < 3; f++) { drawSprite(tex.context, personaje(d, f, pelo), i * 16, 0, pal); i++ }
  tex.refresh()
  // frames
  i = 0
  for (const d of dirs) for (let f = 0; f < 3; f++) { tex.add(`${d}${f}`, 0, i * 16, 0, 16, 24); i++ }
  for (const d of dirs) {
    scene.anims.create({ key: `${key}-walk-${d}`, frames: [0, 1, 0, 2].map(f => ({ key, frame: `${d}${f}` })), frameRate: 8, repeat: -1 })
    scene.anims.create({ key: `${key}-idle-${d}`, frames: [{ key, frame: `${d}0` }], frameRate: 1 })
  }
}
