import { useEffect, useState } from 'react'
import { supabase, ESTADOS } from '../lib/supabase'
import NuevaTarea from '../components/NuevaTarea.jsx'

// Kanban. Arrastras una tarjeta a una columna -> cambia `estado` en Supabase
// -> el orquestador despierta al agente de esa columna.
export default function Tablero() {
  const [tareas, setTareas] = useState([])
  const [productos, setProductos] = useState([])
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    cargar()
    const ch = supabase.channel('tablero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function cargar() {
    const { data } = await supabase.from('tareas').select('*, productos(nombre, slug)').order('prioridad', { ascending: false }).order('creado_en')
    setTareas(data || [])
    const { data: p } = await supabase.from('productos').select('id, nombre').order('nombre')
    setProductos(p || [])
  }

  async function mover(id, estado) {
    const col = ESTADOS.find(e => e.id === estado)
    const t = tareas.find(x => x.id === id)
    await supabase.from('tareas').update({ estado, asignado_a: col.agente }).eq('id', id)
    // Si la tarea vive en Paperclip, se lo pedimos al Jefe (el puente lo convierte en comentario)
    if (t?.paperclip_id) {
      const destino = col.agente ? `pásala a ${col.agente}` : 'dala por terminada (listo)'
      await supabase.from('mensajes').insert({ de: 'ivan', para: 'jefe', tarea_id: id, contenido: `Iván ha movido esta tarea en el tablero: ${destino}.`, tipo: 'texto' })
    }
  }

  return (
    <div className="tablero">
      <NuevaTarea productos={productos} onCreada={cargar} />

      <div className="columnas">
        {ESTADOS.map(col => (
          <div key={col.id} className="columna"
            onDragOver={e => e.preventDefault()}
            onDrop={e => mover(e.dataTransfer.getData('id'), col.id)}>
            <h3>{col.nombre} <span className="muted">{col.agente ? '· ' + col.agente : ''}</span></h3>
            {tareas.filter(t => t.estado === col.id).map(t => (
              <div key={t.id} className="tarjeta" draggable
                onDragStart={e => e.dataTransfer.setData('id', t.id)}
                onClick={() => setAbierta(t)}>
                <b>{t.titulo}</b>
                {t.productos && <div className="muted">📦 {t.productos.nombre}</div>}
                <div className="muted">{t.audio_path ? '🎙 ' : ''}{t.referencia_url ? '🔗 ' : ''}{t.fotos_paths?.length ? '📷 ' : ''}</div>
                {t.asignado_a && <div className="chip">{t.asignado_a}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {abierta && <DetalleTarea tarea={abierta} cerrar={() => setAbierta(null)} />}
    </div>
  )
}

function DetalleTarea({ tarea, cerrar }) {
  const [mensajes, setMensajes] = useState([])
  useEffect(() => {
    supabase.from('mensajes').select('*').eq('tarea_id', tarea.id).order('creado_en').then(({ data }) => setMensajes(data || []))
    const ch = supabase.channel('tarea-' + tarea.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `tarea_id=eq.${tarea.id}` },
        p => setMensajes(m => [...m, p.new]))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tarea.id])

  return (
    <div className="modal" onClick={cerrar}>
      <div className="card" onClick={e => e.stopPropagation()}>
        <h2>{tarea.titulo}</h2>
        {tarea.descripcion && <p style={{ whiteSpace: 'pre-wrap' }}>{tarea.descripcion}</p>}
        {tarea.transcripcion && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>🎙 {tarea.transcripcion}</p>}
        {tarea.audio_path && !tarea.transcripcion && <p className="muted">🎙 Audio enviado, transcribiendo…</p>}
        {tarea.referencia_url && <p>🔗 <a href={tarea.referencia_url} target="_blank" rel="noreferrer">{tarea.referencia_url}</a></p>}
        {tarea.fotos_paths?.length > 0 && <p className="muted">📷 {tarea.fotos_paths.length} foto(s) adjuntas</p>}
        <p className="muted">Estado: {tarea.estado} · Asignado: {tarea.asignado_a || '—'}
          {tarea.paperclip_identifier && <> · <a href={`https://oficina-49-12-251-2.sslip.io/IVA/issues/${tarea.paperclip_identifier}`} target="_blank" rel="noreferrer">ver en Paperclip ↗</a></>}
        </p>
        {tarea.resultado && Object.keys(tarea.resultado).length > 0 && (
          <pre className="resultado">{JSON.stringify(tarea.resultado, null, 2)}</pre>
        )}
        <h3>Conversación entre agentes</h3>
        <div className="chat-mensajes">
          {mensajes.map(m => (
            <div key={m.id} className={'burbuja ' + (m.de === 'ivan' ? 'yo' : 'agente')}>
              <small>{m.de} → {m.para || 'todos'}</small>{m.contenido}
            </div>
          ))}
        </div>
        <button onClick={cerrar}>Cerrar</button>
      </div>
    </div>
  )
}
