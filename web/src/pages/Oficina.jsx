import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { supabase } from '../lib/supabase'
import ChatJefe from '../components/ChatJefe.jsx'
import OficinaScene, { ANCHO, ALTO } from '../game/OficinaScene.js'

// La oficina pixel art. Lo que mueve a los personajes es SOLO el estado en Supabase (realtime),
// que a su vez refleja Paperclip (agentes trabajando, tareas, entregas).
export default function Oficina() {
  const hostRef = useRef(null)
  const busRef = useRef(null)
  const [agentes, setAgentes] = useState([])
  const [tareas, setTareas] = useState([])
  const [actividad, setActividad] = useState([])
  const [sel, setSel] = useState(null)

  // --- Phaser ---
  useEffect(() => {
    const bus = new Phaser.Events.EventEmitter()
    busRef.current = bus
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: hostRef.current, width: ANCHO, height: ALTO, pixelArt: true, roundPixels: true,
      backgroundColor: '#0f1116', scene: [new OficinaScene(bus)],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    bus.on('click-agente', (id) => setSel(id))
    return () => { game.destroy(true); busRef.current = null }
  }, [])

  // --- datos ---
  useEffect(() => {
    cargar()
    const ch = supabase.channel('oficina-px')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, cargar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, (p) => {
        setActividad(a => [p.new, ...a].slice(0, 40))
        if (p.new.agente_id && busRef.current) busRef.current.emit('bocadillo', { id: p.new.agente_id, texto: textoAccion(p.new) })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (p) => {
        const m = p.new
        if (m.de && m.de !== 'ivan' && m.de !== 'sistema' && busRef.current) busRef.current.emit('bocadillo', { id: m.de, texto: '💬 ' + m.contenido })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function cargar() {
    const [{ data: ag }, { data: ta }, { data: act }] = await Promise.all([
      supabase.from('agentes').select('*').order('id'),
      supabase.from('tareas').select('*').neq('estado', 'listo').order('actualizado_en', { ascending: false }),
      supabase.from('actividad').select('*').order('creado_en', { ascending: false }).limit(40),
    ])
    setAgentes(ag || []); setTareas(ta || []); setActividad(act || [])
    const estados = {}
    for (const a of ag || []) {
      const t = (ta || []).find(x => x.asignado_a === a.id)
      estados[a.id] = { estado: a.estado, tarea: t ? t.titulo.replace(/^IVA-\d+ · /, '') : '' }
    }
    busRef.current?.emit('estado', estados)
  }

  const tareasSel = tareas.filter(t => t.asignado_a === sel)
  const agSel = agentes.find(a => a.id === sel)

  return (
    <div className="oficina">
      <div className="juego-wrap">
        <div ref={hostRef} className="juego" />
        <div className="leyenda">
          {agentes.map(a => (
            <span key={a.id} onClick={() => setSel(a.id)} style={{ cursor: 'pointer' }}><i style={{ background: a.color }} /> {a.nombre} · <b className={a.estado}>{a.estado}</b></span>
          ))}
          <span className="muted">Haz clic en un personaje para ver qué está haciendo.</span>
        </div>
      </div>
      <aside className="lateral">
        {agSel ? (
          <div className="card">
            <div className="fila"><h3 style={{ margin: 0 }}><i className="punto" style={{ background: agSel.color }} /> {agSel.nombre}</h3><span className="espacio" /><button className="link" onClick={() => setSel(null)}>cerrar</button></div>
            <p className="muted">{agSel.rol} · {agSel.descripcion}</p>
            <b>Tareas en su mesa</b>
            {tareasSel.length === 0 && <div className="muted">Nada ahora mismo.</div>}
            {tareasSel.map(t => (
              <div key={t.id} className="tarjeta">
                <b>{t.titulo}</b>
                <div className="muted">{t.estado}{t.paperclip_identifier && <> · <a href={`https://oficina-49-12-251-2.sslip.io/IVA/issues/${t.paperclip_identifier}`} target="_blank" rel="noreferrer">Paperclip ↗</a></>}</div>
              </div>
            ))}
          </div>
        ) : <ChatJefe />}
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

function textoAccion(a) {
  return ({ empieza: '⚡ Me pongo con ello', entrega: '✅ Entregado', falla: '⚠️ Me he atascado', recibe_tarea: '📥 Tarea nueva', asigna: '📤 Asignando…', crea_tarea: '📝 Creo la tarea' })[a.accion] || a.accion
}
