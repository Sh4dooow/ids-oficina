import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { supabase } from '../lib/supabase'
import ChatJefe from '../components/ChatJefe.jsx'
import Personalizar from '../components/Personalizar.jsx'
import OficinaScene, { ANCHO, ALTO } from '../game/OficinaScene.js'

export default function Oficina() {
  const hostRef = useRef(null), busRef = useRef(null)
  const [agentes, setAgentes] = useState([])
  const [tareas, setTareas] = useState([])
  const [actividad, setActividad] = useState([])
  const [sel, setSel] = useState(null)
  const [pestana, setPestana] = useState('tareas')
  const [chatAbierto, setChatAbierto] = useState(false)
  const agentesRef = useRef([])

  useEffect(() => {
    const bus = new Phaser.Events.EventEmitter(); busRef.current = bus
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: hostRef.current, width: ANCHO, height: ALTO, pixelArt: true, roundPixels: true,
      backgroundColor: '#0b0d12', scene: [new OficinaScene(bus)],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    bus.on('click-agente', (id) => { setSel(id); setPestana('tareas') })
    // cuando la escena esté lista, mandar apariencias
    game.events.once('ready', () => { for (const a of agentesRef.current) bus.emit('apariencia', { id: a.id, apariencia: a.apariencia, nombre: a.nombre }) })
    return () => { game.destroy(true); busRef.current = null }
  }, [])

  useEffect(() => {
    cargar()
    const ch = supabase.channel('oficina-px')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, cargar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, (p) => {
        setActividad(a => [p.new, ...a].slice(0, 40))
        if (p.new.agente_id) busRef.current?.emit('bocadillo', { id: p.new.agente_id, texto: textoAccion(p.new) })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (p) => {
        const m = p.new
        if (m.de && !['ivan', 'sistema'].includes(m.de)) busRef.current?.emit('bocadillo', { id: m.de, texto: '💬 ' + m.contenido })
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
    setAgentes(ag || []); agentesRef.current = ag || []; setTareas(ta || []); setActividad(act || [])
    const estados = {}
    for (const a of ag || []) {
      const t = (ta || []).find(x => x.asignado_a === a.id)
      estados[a.id] = { estado: a.estado, tarea: t ? t.titulo.replace(/^IVA-\d+ · /, '') : '' }
      busRef.current?.emit('apariencia', { id: a.id, apariencia: a.apariencia, nombre: a.nombre })
    }
    busRef.current?.emit('estado', estados)
  }

  const agSel = agentes.find(a => a.id === sel)
  const tareasSel = tareas.filter(t => t.asignado_a === sel)

  return (
    <div className="oficina-v2">
      <div className="barra-estado">
        {agentes.map(a => (
          <button key={a.id} className={'chip-agente ' + (sel === a.id ? 'activo' : '')} onClick={() => { setSel(a.id); setPestana('tareas') }}>
            <i style={{ background: a.color }} /> {a.nombre} <b className={a.estado}>{a.estado}</b>
          </button>
        ))}
        <span className="espacio" />
        <button className="btn-sec" onClick={() => setChatAbierto(v => !v)}>💬 Hablar con el Jefe</button>
      </div>

      <div className="escenario">
        <div ref={hostRef} className="juego" />

        {agSel && (
          <aside className="panel-flotante">
            <div className="fila">
              <h3 style={{ margin: 0 }}><i className="punto" style={{ background: agSel.color }} /> {agSel.nombre}</h3>
              <span className="muted">{agSel.rol}</span><span className="espacio" />
              <button className="link" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="tabs">
              <button className={pestana === 'tareas' ? 'activo' : ''} onClick={() => setPestana('tareas')}>Tareas</button>
              <button className={pestana === 'personalizar' ? 'activo' : ''} onClick={() => setPestana('personalizar')}>Personalizar</button>
            </div>
            {pestana === 'tareas' ? (
              <div className="panel-cuerpo">
                <p className="muted">{agSel.descripcion}</p>
                {tareasSel.length === 0 && <div className="muted">Sin tareas ahora mismo.</div>}
                {tareasSel.map(t => (
                  <div key={t.id} className="tarjeta">
                    <b>{t.titulo}</b>
                    <div className="muted">{t.estado}{t.paperclip_identifier && <> · <a href={`https://oficina-49-12-251-2.sslip.io/IVA/issues/${t.paperclip_identifier}`} target="_blank" rel="noreferrer">Paperclip ↗</a></>}</div>
                  </div>
                ))}
                <h4>Actividad reciente</h4>
                <ul className="actividad">
                  {actividad.filter(x => x.agente_id === sel).slice(0, 8).map(x => <li key={x.id}>{textoAccion(x)} <span className="muted">{new Date(x.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></li>)}
                </ul>
              </div>
            ) : (
              <Personalizar agente={agSel} onGuardado={cargar} />
            )}
          </aside>
        )}

        {chatAbierto && (
          <aside className="panel-flotante chat-flotante">
            <div className="fila"><b>Jefe</b><span className="espacio" /><button className="link" onClick={() => setChatAbierto(false)}>✕</button></div>
            <ChatJefe />
          </aside>
        )}
      </div>

      <div className="ticker">
        {actividad.slice(0, 6).map(a => <span key={a.id}><b>{a.agente_id}</b> {textoAccion(a)}</span>)}
        {actividad.length === 0 && <span className="muted">Sin actividad todavía. Cuando los agentes trabajen, lo verás aquí y en la oficina.</span>}
      </div>
    </div>
  )
}

function textoAccion(a) {
  return ({ empieza: '⚡ Me pongo con ello', entrega: '✅ Entregado', falla: '⚠️ Me he atascado', recibe_tarea: '📥 Tarea nueva', asigna: '📤 Asignando…', crea_tarea: '📝 Creo la tarea' })[a.accion] || a.accion
}
