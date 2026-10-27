import { useEffect, useState } from 'react'
import { supabase, ESTADOS } from '../lib/supabase'
import NuevaTarea from '../components/NuevaTarea.jsx'
import Aprobaciones from '../components/Aprobaciones.jsx'
import { BarraFase, AccionesRevision, TE_TOCA, FASES } from '../components/Fase.jsx'

// Kanban. Arrastras una tarjeta a una columna -> cambia `estado` en Supabase
// -> el orquestador despierta al agente de esa columna.
export default function Tablero() {
  const [tareas, setTareas] = useState([])
  const [productos, setProductos] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [verTerminadas, setVerTerminadas] = useState(false)

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
    // mover_a lo lee el puente del servidor y reasigna la tarea en Paperclip de verdad
    await supabase.from('tareas').update({ estado, asignado_a: col.agente, mover_a: col.agente || 'listo' }).eq('id', id)
  }

  const teToca = tareas.filter(t => TE_TOCA.includes(t.fase))
  const activas = tareas.filter(t => verTerminadas || t.fase !== 'terminada')

  return (
    <div className="tablero">
      <section className="te-toca">
        <h2>⚡ Te toca a ti {teToca.length > 0 && <span className="contador">{teToca.length}</span>}</h2>
        {teToca.length === 0 && <div className="muted">Nada pendiente de ti. Cuando un agente necesite tu OK o tenga algo listo para revisar, aparecerá aquí.</div>}
        {teToca.map(t => (
          <div key={t.id} className="tarjeta te-toca-item">
            <div className="fila"><b>{t.titulo}</b><span className="espacio" /><span className="chip">{t.asignado_a}</span></div>
            <BarraFase fase={t.fase} />
            {t.ultimo_mensaje && <div className="muted pre">{t.ultimo_mensaje}</div>}
            {t.fase === 'para_revisar' && <AccionesRevision tareaId={t.id} identifier={t.paperclip_identifier} />}
            {t.fase === 'esperando_ok' && <div className="muted">👇 Responde en el panel «Pendiente de tu OK» de abajo.</div>}
          </div>
        ))}
        <Aprobaciones compacto />
      </section>

      <NuevaTarea productos={productos} onCreada={cargar} />

      <div className="fila"><h2 style={{ margin: '8px 0' }}>Todas las tareas</h2><span className="espacio" />
        <label className="muted"><input type="checkbox" checked={verTerminadas} onChange={e => setVerTerminadas(e.target.checked)} /> ver terminadas</label></div>
      <div className="columnas">
        {ESTADOS.map(col => (
          <div key={col.id} className="columna"
            onDragOver={e => e.preventDefault()}
            onDrop={e => mover(e.dataTransfer.getData('id'), col.id)}>
            <h3>{col.nombre} <span className="muted">{col.agente ? '· ' + col.agente : ''}</span></h3>
            {activas.filter(t => t.estado === col.id).map(t => (
              <div key={t.id} className={'tarjeta ' + (TE_TOCA.includes(t.fase) ? 'destacada' : '')} draggable
                onDragStart={e => e.dataTransfer.setData('id', t.id)}
                onClick={() => setAbierta(t)}>
                <b>{t.titulo}</b>
                <BarraFase fase={t.fase} />
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
        <BarraFase fase={tarea.fase} />
        {tarea.fase === 'para_revisar' && <AccionesRevision tareaId={tarea.id} identifier={tarea.paperclip_identifier} onHecho={cerrar} />}
        {tarea.ultimo_mensaje && <p className="muted pre">Último mensaje del agente: {tarea.ultimo_mensaje}</p>}
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
