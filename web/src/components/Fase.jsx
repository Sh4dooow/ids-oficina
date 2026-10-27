import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Las 5 fases por las que pasa cualquier tarea. Se pinta como una barra de pasos.
export const FASES = [
  { id: 'pedida', nombre: 'Pedida', icono: '📨' },
  { id: 'en_marcha', nombre: 'En marcha', icono: '💻' },
  { id: 'esperando_ok', nombre: 'Tu OK', icono: '🙋' },
  { id: 'para_revisar', nombre: 'Revisar', icono: '👀' },
  { id: 'terminada', nombre: 'Terminada', icono: '✅' },
]
export const TE_TOCA = ['esperando_ok', 'para_revisar']

export function BarraFase({ fase }) {
  const parada = fase === 'parada'
  const idx = Math.max(0, FASES.findIndex(f => f.id === (parada ? 'en_marcha' : fase)))
  return (
    <div className="barra-fase" title={parada ? 'Nadie la está trabajando ahora mismo; se reactiva sola' : FASES[idx].nombre}>
      {FASES.map((f, i) => (
        <span key={f.id} className={'paso ' + (i < idx ? 'hecho' : i === idx ? (parada ? 'parada' : 'actual') : '')}>
          <i>{i === idx && parada ? '⏸' : f.icono}</i><small>{i === idx && parada ? 'Parada' : f.nombre}</small>
        </span>
      ))}
    </div>
  )
}

// Botones "me vale / corregir" para una tarea que está en revisión. Se usan en la campana y en el tablero.
export function AccionesRevision({ tareaId, identifier, onHecho }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [leccion, setLeccion] = useState(true)
  const [hecho, setHecho] = useState(null)

  async function terminar() {
    await supabase.from('tareas').update({ mover_a: 'listo', fase: 'terminada' }).eq('id', tareaId)
    setHecho('terminada'); onHecho?.('terminada')
    window.oficinaBus?.emit('ceo', { accion: 'terminar', texto: '✅ ' + identifier + ' terminada' })
  }
  async function corregir() {
    const t = texto.trim(); if (!t) return
    await supabase.from('tareas').update({ correccion: t, correccion_leccion: leccion, fase: 'en_marcha' }).eq('id', tareaId)
    setHecho('corregida'); setEditando(false); onHecho?.('corregida')
    window.oficinaBus?.emit('ceo', { accion: 'corregir', texto: '✏️ ' + t, tareaId })
  }

  if (hecho) return <div className="muted">{hecho === 'terminada' ? '✅ Terminada. El vídeo se guarda en tu Drive con su número.' : '📨 Corrección enviada. Te avisaré cuando la rehaga.'}</div>
  return (
    <div className="aviso-acciones" onClick={e => e.stopPropagation()}>
      {!editando ? (
        <div className="fila">
          <button className="btn-ok" onClick={terminar}>✅ Me vale · terminar</button>
          <button className="btn-sec" onClick={() => setEditando(true)}>✏️ No me vale · corregir</button>
        </div>
      ) : (
        <div className="aviso-corregir">
          <textarea rows={3} autoFocus placeholder="Qué está mal y cómo lo quieres" value={texto} onChange={e => setTexto(e.target.value)} />
          <label className="muted"><input type="checkbox" checked={leccion} onChange={e => setLeccion(e.target.checked)} /> guardar también como lección para que no se repita</label>
          <div className="fila">
            <button className="btn-ok" onClick={corregir}>📨 Enviar corrección</button>
            <button className="link" onClick={() => setEditando(false)}>cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
