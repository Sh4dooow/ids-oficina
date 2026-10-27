import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ICONO = { revisar: '👀', terminada: '✅', ok: '🙋', pregunta: '❓', info: 'ℹ️' }

// Campana de avisos: lo que Iván tiene que mirar (tareas listas para revisar, terminadas, OKs pendientes).
export default function Avisos() {
  const [avisos, setAvisos] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [textos, setTextos] = useState({})
  const [leccion, setLeccion] = useState({})
  const [hechos, setHechos] = useState({})
  const noLeidos = avisos.filter(a => !a.leido).length

  useEffect(() => {
    supabase.from('avisos').select('*').order('creado_en', { ascending: false }).limit(60).then(({ data }) => setAvisos(data || []))
    const ch = supabase.channel('avisos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, p => {
        setAvisos(a => [p.new, ...a].slice(0, 60))
        try { if (Notification?.permission === 'granted') new Notification(p.new.titulo, { body: p.new.texto?.slice(0, 120) }) } catch {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'avisos' }, p => setAvisos(a => a.map(x => x.id === p.new.id ? p.new : x)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => { document.title = (noLeidos ? `(${noLeidos}) ` : '') + 'Iván Digital Studio · Oficina' }, [noLeidos])

  async function marcar(id) { await supabase.from('avisos').update({ leido: true }).eq('id', id) }
  async function marcarTodo() { await supabase.from('avisos').update({ leido: true }).eq('leido', false) }
  function pedirPermiso() { try { Notification?.requestPermission?.() } catch {} }

  async function tareaDe(identifier) {
    const { data } = await supabase.from('tareas').select('id').eq('paperclip_identifier', identifier).limit(1)
    return data?.[0]?.id
  }
  async function terminar(a) {
    const id = await tareaDe(a.tarea_identifier); if (!id) return alert('No encuentro la tarea ' + a.tarea_identifier)
    await supabase.from('tareas').update({ mover_a: 'listo' }).eq('id', id)
    await marcar(a.id); setEditando(null); setHechos(h => ({ ...h, [a.id]: 'terminada' }))
  }
  async function corregir(a) {
    const txt = (textos[a.id] || '').trim(); if (!txt) return
    const id = await tareaDe(a.tarea_identifier); if (!id) return alert('No encuentro la tarea ' + a.tarea_identifier)
    await supabase.from('tareas').update({ correccion: txt, correccion_leccion: leccion[a.id] !== false }).eq('id', id)
    await marcar(a.id); setEditando(null); setTextos(t => ({ ...t, [a.id]: '' })); setHechos(h => ({ ...h, [a.id]: 'corregida' }))
  }

  return (
    <div className="avisos">
      <button className={'btn-sec campana ' + (noLeidos ? 'con-avisos' : '')} onClick={() => { setAbierto(v => !v); pedirPermiso() }}>
        🔔 Avisos {noLeidos > 0 && <b className="contador">{noLeidos}</b>}
      </button>
      {abierto && (
        <div className="avisos-lista">
          <div className="fila"><b>Avisos</b><span className="espacio" />
            {noLeidos > 0 && <button className="link" onClick={marcarTodo}>marcar todo leído</button>}
            <button className="link" onClick={() => setAbierto(false)}>✕</button>
          </div>
          {avisos.length === 0 && <div className="muted">Nada pendiente. Cuando un agente termine algo o necesite tu OK, saldrá aquí.</div>}
          {avisos.map(a => (
            <div key={a.id} className={'aviso-item ' + (a.leido ? 'leido' : '')} onClick={() => !a.leido && a.tipo !== 'revisar' && marcar(a.id)}>
              <div className="fila"><span>{ICONO[a.tipo] || 'ℹ️'}</span><b>{a.titulo}</b><span className="espacio" />
                <span className="muted">{new Date(a.creado_en).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
              {a.texto && <div className="muted pre">{a.texto}</div>}
              {a.tarea_identifier && <a className="link" href={`https://oficina-49-12-251-2.sslip.io/IVA/issues/${a.tarea_identifier}`} target="_blank" rel="noreferrer">abrir {a.tarea_identifier} ↗</a>}
              {hechos[a.id] && <div className="muted">{hechos[a.id] === 'terminada' ? '✅ Enviado: tarea terminada' : '📨 Corrección enviada al agente'}</div>}
              {a.tipo === 'revisar' && !hechos[a.id] && (
                <div className="aviso-acciones" onClick={e => e.stopPropagation()}>
                  {editando !== a.id ? (
                    <div className="fila">
                      <button className="btn-ok" onClick={() => terminar(a)}>✅ Me vale · terminar</button>
                      <button className="btn-sec" onClick={() => setEditando(a.id)}>✏️ No me vale · corregir</button>
                    </div>
                  ) : (
                    <div className="aviso-corregir">
                      <textarea rows={3} placeholder="Qué está mal y cómo lo quieres (ej: el casco se ve raro, el humo tiene que ser blanco, no azul)" value={textos[a.id] || ''} onChange={e => setTextos(t => ({ ...t, [a.id]: e.target.value }))} autoFocus />
                      <label className="muted"><input type="checkbox" checked={leccion[a.id] !== false} onChange={e => setLeccion(l => ({ ...l, [a.id]: e.target.checked }))} /> guardar también como lección para que no se repita</label>
                      <div className="fila">
                        <button className="btn-ok" onClick={() => corregir(a)}>📨 Enviar corrección</button>
                        <button className="link" onClick={() => setEditando(null)}>cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
