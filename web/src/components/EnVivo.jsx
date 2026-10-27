import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Qué está haciendo cada agente, al segundo. Lee la tabla en_vivo (la alimenta el servidor desde los logs de Paperclip).
export default function EnVivo({ agentes, filtro, onFiltro }) {
  const [filas, setFilas] = useState([])
  const [pausado, setPausado] = useState(false)
  const fin = useRef(null)

  useEffect(() => {
    supabase.from('en_vivo').select('*').order('creado_en', { ascending: false }).limit(150).then(({ data }) => setFilas((data || []).reverse()))
    const ch = supabase.channel('en-vivo')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'en_vivo' }, p => setFilas(f => [...f, p.new].slice(-300)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  useEffect(() => { if (!pausado) fin.current?.scrollIntoView({ block: 'end' }) }, [filas, pausado])

  const visibles = filas.filter(f => !filtro || f.agente_id === filtro)
  const ultimo = {}
  for (const f of filas) ultimo[f.agente_id] = f
  const color = id => agentes.find(a => a.id === id)?.color || '#888'
  const nombre = id => agentes.find(a => a.id === id)?.nombre || id

  return (
    <div className="envivo">
      <div className="envivo-cabecera">
        <b>📡 En vivo</b>
        <div className="envivo-filtros">
          <button className={!filtro ? 'activo' : ''} onClick={() => onFiltro(null)}>Todos</button>
          {agentes.map(a => <button key={a.id} className={filtro === a.id ? 'activo' : ''} onClick={() => onFiltro(a.id)}><i style={{ background: a.color }} />{a.nombre}</button>)}
        </div>
        <span className="espacio" />
        <button className="link" onClick={() => setPausado(p => !p)}>{pausado ? '▶ seguir' : '⏸ pausar scroll'}</button>
      </div>
      <div className="envivo-ahora">
        {agentes.map(a => {
          const u = ultimo[a.id]
          return (
            <div key={a.id} className="envivo-ahora-item" onClick={() => onFiltro(a.id)}>
              <i style={{ background: a.color }} /><b>{a.nombre}</b>
              <span className={'estado ' + a.estado}>{a.estado}</span>
              <span className="muted">{u ? u.texto : '— sin actividad —'}</span>
            </div>
          )
        })}
      </div>
      <div className="envivo-lista">
        {visibles.length === 0 && <div className="muted">Todavía no hay actividad. En cuanto un agente empiece una vuelta de trabajo, verás aquí cada paso.</div>}
        {visibles.map(f => (
          <div key={f.id} className={'envivo-fila ' + f.tipo}>
            <span className="hora">{new Date(f.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="quien" style={{ color: color(f.agente_id) }}>{nombre(f.agente_id)}</span>
            {f.tarea && <span className="chip">{f.tarea}</span>}
            <span className="texto">{f.texto}</span>
          </div>
        ))}
        <div ref={fin} />
      </div>
    </div>
  )
}
