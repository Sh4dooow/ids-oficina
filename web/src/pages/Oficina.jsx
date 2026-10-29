import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { supabase } from '../lib/supabase'
import ChatJefe from '../components/ChatJefe.jsx'
import Personalizar from '../components/Personalizar.jsx'
import EnVivo from '../components/EnVivo.jsx'
import Aprobaciones from '../components/Aprobaciones.jsx'
import Avisos from '../components/Avisos.jsx'
import OficinaScene, { ANCHO, ALTO } from '../game/OficinaScene.js'
import Oficina3D from '../game/Oficina3D.js'

export default function Oficina() {
  const hostRef = useRef(null), busRef = useRef(null)
  const [agentes, setAgentes] = useState([])
  const [tareas, setTareas] = useState([])
  const [actividad, setActividad] = useState([])
  const [sel, setSel] = useState(null)
  const [pestana, setPestana] = useState('tareas')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [filtroVivo, setFiltroVivo] = useState(null)
  const agentesRef = useRef([])

  const [modo3d, setModo3d] = useState(() => localStorage.getItem('oficina_modo') !== '2d')

  useEffect(() => {
    const bus = new Phaser.Events.EventEmitter(); busRef.current = bus; window.oficinaBus = bus
    bus.on('click-agente', (id) => { setSel(id); setPestana('tareas') })
    const mandarApariencias = () => { for (const a of agentesRef.current) bus.emit('apariencia', { id: a.id, apariencia: a.apariencia, nombre: a.nombre }) }
    let limpiar
    if (modo3d) {
      const esc = new Oficina3D(bus); esc.montar(hostRef.current); mandarApariencias()
      limpiar = () => esc.destruir()
    } else {
      const game = new Phaser.Game({
        type: Phaser.AUTO, parent: hostRef.current, width: ANCHO, height: ALTO, pixelArt: true, roundPixels: true,
        backgroundColor: '#0b0d12', scene: [new OficinaScene(bus)],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      })
      game.events.once('ready', mandarApariencias)
      limpiar = () => game.destroy(true)
    }
    cargar()
    return () => { limpiar(); busRef.current = null }
  }, [modo3d])

  useEffect(() => {
    cargar()
    const ch = supabase.channel('oficina-px')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, cargar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, (p) => {
        setActividad(a => [p.new, ...a].slice(0, 40))
        if (p.new.agente_id) busRef.current?.emit('bocadillo', { id: p.new.agente_id, texto: textoAccion(p.new) })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'en_vivo' }, (p) => {
        const f = p.new
        if (f.agente_id && f.tipo !== 'piensa') busRef.current?.emit('bocadillo', { id: f.agente_id, texto: f.texto.slice(0, 60) })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (p) => {
        const m = p.new
        if (m.de && !['ivan', 'sistema'].includes(m.de)) busRef.current?.emit('bocadillo', { id: m.de, texto: '💬 ' + m.contenido })
        if (m.de === 'ivan') busRef.current?.emit('ceo', { accion: 'mensaje', texto: '💬 ' + m.contenido.slice(0, 80), agente: m.para })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tareas' }, (p) => {
        if (p.new.origen !== 'paperclip') busRef.current?.emit('ceo', { accion: 'tarea', texto: '📨 Nueva tarea: ' + (p.new.titulo || '').slice(0, 70) })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aprobaciones' }, (p) => {
        const a = p.new
        if (a.decision && !p.old?.decision) busRef.current?.emit('ceo', { accion: a.decision === 'no' ? 'rechazar' : 'aprobar', texto: (a.decision === 'no' ? '❌ No: ' : '✅ OK: ') + (a.nota || a.tarea || ''), agente: a.agente_id })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lecciones' }, (p) => {
        busRef.current?.emit('ceo', { accion: 'leccion', texto: '📚 Lección: ' + (p.new.titulo || '').slice(0, 70) })
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
        <Avisos />
        <button className="btn-sec" title="Cambiar entre oficina 3D y pixel" onClick={() => { const v = !modo3d; localStorage.setItem('oficina_modo', v ? '3d' : '2d'); setModo3d(v) }}>{modo3d ? '🕹️ Ver en pixel' : '🧊 Ver en 3D'}</button>
        <button className="btn-sec" onClick={() => setChatAbierto(v => !v)}>💬 Hablar con el Jefe</button>
      </div>

      <div className="escenario">
        <div ref={hostRef} className={"juego" + (modo3d ? " juego3d" : "")} />

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

      <Aprobaciones compacto />
      <EnVivo agentes={agentes} filtro={filtroVivo} onFiltro={setFiltroVivo} />
    </div>
  )
}

function textoAccion(a) {
  return ({ empieza: '⚡ Me pongo con ello', entrega: '✅ Entregado', falla: '⚠️ Me he atascado', recibe_tarea: '📥 Tarea nueva', asigna: '📤 Asignando…', crea_tarea: '📝 Creo la tarea' })[a.accion] || a.accion
}
