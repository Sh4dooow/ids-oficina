import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import ChatJefe from '../components/ChatJefe.jsx'

// Oficina: rejilla de 16x9 celdas. Cada agente tiene una mesa y un sprite.
// Lo que mueve a los sprites es SOLO el estado en Supabase (realtime).
const COLS = 16, FILAS = 9, CELDA = 56

export default function Oficina() {
  const canvasRef = useRef(null)
  const [agentes, setAgentes] = useState([])
  const [actividad, setActividad] = useState([])
  const sprites = useRef({}) // posición animada por agente

  useEffect(() => {
    cargar()
    const ch = supabase.channel('oficina')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes' }, cargar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, (p) => {
        setActividad(a => [p.new, ...a].slice(0, 30))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function cargar() {
    const { data } = await supabase.from('agentes').select('*').order('id')
    setAgentes(data || [])
    const { data: act } = await supabase.from('actividad').select('*').order('creado_en', { ascending: false }).limit(30)
    setActividad(act || [])
  }

  // Bucle de dibujo
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    function dibujar() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // suelo
      for (let x = 0; x < COLS; x++) for (let y = 0; y < FILAS; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#2a2f3a' : '#272c36'
        ctx.fillRect(x * CELDA, y * CELDA, CELDA, CELDA)
      }
      // zonas
      zona(ctx, 0, 0, 16, 1, '#1d2230', 'RECEPCIÓN · aquí entran las tareas')
      zona(ctx, 13, 7, 3, 2, '#1f3a2a', 'LISTO')
      zona(ctx, 0, 7, 3, 2, '#3a2a1f', 'ESCUELA')

      for (const a of agentes) {
        // mesa
        ctx.fillStyle = '#5b4636'
        ctx.fillRect(a.mesa_x * CELDA + 6, a.mesa_y * CELDA + 30, CELDA - 12, 20)
        ctx.fillStyle = '#9aa'
        ctx.fillRect(a.mesa_x * CELDA + 18, a.mesa_y * CELDA + 14, 20, 14) // monitor

        // destino: trabajando -> mesa; libre -> deambula cerca; esperando -> recepción
        const s = sprites.current[a.id] ||= { x: a.pos_x * CELDA, y: a.pos_y * CELDA, tx: 0, ty: 0, t: 0 }
        s.t++
        if (a.estado === 'trabajando') { s.tx = a.mesa_x * CELDA; s.ty = (a.mesa_y - 1) * CELDA }
        else if (a.estado === 'esperando') { s.tx = 7 * CELDA; s.ty = 1 * CELDA }
        else if (s.t % 240 === 0) {
          s.tx = (a.mesa_x + (Math.random() * 4 - 2) | 0) * CELDA
          s.ty = (a.mesa_y + (Math.random() * 3 - 1) | 0) * CELDA
          s.tx = Math.max(0, Math.min((COLS - 1) * CELDA, s.tx))
          s.ty = Math.max(CELDA, Math.min((FILAS - 2) * CELDA, s.ty))
        }
        s.x += (s.tx - s.x) * 0.06
        s.y += (s.ty - s.y) * 0.06

        // sprite
        const cx = s.x + CELDA / 2, cy = s.y + CELDA / 2
        ctx.fillStyle = a.color
        ctx.beginPath(); ctx.arc(cx, cy - 8, 12, 0, Math.PI * 2); ctx.fill() // cabeza
        ctx.fillRect(cx - 10, cy + 2, 20, 18) // cuerpo
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'
        ctx.fillText(a.nombre, cx, cy + 34)
        if (a.estado === 'trabajando') {
          ctx.fillStyle = '#ffd666'; ctx.font = '14px system-ui'
          ctx.fillText('💻', cx + 18, cy - 14)
        }
      }
      raf = requestAnimationFrame(dibujar)
    }
    dibujar()
    return () => cancelAnimationFrame(raf)
  }, [agentes])

  return (
    <div className="oficina">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={COLS * CELDA} height={FILAS * CELDA} />
        <div className="leyenda">
          {agentes.map(a => (
            <span key={a.id}><i style={{ background: a.color }} /> {a.nombre} · <b className={a.estado}>{a.estado}</b></span>
          ))}
        </div>
      </div>
      <aside className="lateral">
        <ChatJefe />
        <h3>Actividad</h3>
        <ul className="actividad">
          {actividad.map(a => (
            <li key={a.id}><b>{a.agente_id}</b> {a.accion} <span className="muted">{a.detalle}</span></li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function zona(ctx, x, y, w, h, color, texto) {
  ctx.fillStyle = color
  ctx.fillRect(x * CELDA, y * CELDA, w * CELDA, h * CELDA)
  ctx.fillStyle = '#8891a5'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'
  ctx.fillText(texto, x * CELDA + 8, y * CELDA + 16)
}
