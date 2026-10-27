import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Lo que los agentes necesitan que Iván apruebe. Al decidir, el puente lo aplica en Paperclip y despierta al agente.
export default function Aprobaciones({ compacto = false }) {
  const [items, setItems] = useState([])
  const [nota, setNota] = useState({})
  const [verTodas, setVerTodas] = useState(false)

  useEffect(() => {
    cargar()
    const ch = supabase.channel('aprobaciones').on('postgres_changes', { event: '*', schema: 'public', table: 'aprobaciones' }, cargar).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  async function cargar() {
    const { data } = await supabase.from('aprobaciones').select('*').order('creado_en', { ascending: false }).limit(30)
    setItems(data || [])
  }
  async function decidir(a, decision) {
    await supabase.from('aprobaciones').update({ decision, nota: nota[a.id] || null, procesada: false, actualizado_en: new Date().toISOString() }).eq('id', a.id)
  }

  const pendientes = items.filter(a => a.estado === 'pendiente' && !a.decision)
  const enCurso = items.filter(a => a.decision && !a.procesada)
  const lista = verTodas ? items : pendientes

  if (compacto && pendientes.length === 0 && enCurso.length === 0) return null

  return (
    <div className={'aprobaciones ' + (pendientes.length ? 'hay' : '')}>
      <div className="fila">
        <h3 style={{ margin: 0 }}>🙋 Pendiente de tu OK {pendientes.length > 0 && <span className="badge">{pendientes.length}</span>}</h3>
        <span className="espacio" />
        <button className="link" onClick={() => setVerTodas(v => !v)}>{verTodas ? 'solo pendientes' : 'ver historial'}</button>
      </div>
      {lista.length === 0 && <div className="muted">Nada pendiente. Cuando un agente necesite aprobación (gastar créditos, publicar…), aparecerá aquí y te avisará por Telegram.</div>}
      {lista.map(a => (
        <div key={a.id} className={'aprob-item ' + a.estado}>
          <div className="fila">
            {a.tarea && <span className="chip">{a.tarea}</span>}
            <b>{a.agente_id || 'agente'}</b>
            <span className="muted">{new Date(a.creado_en).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
            <span className="espacio" />
            {a.estado !== 'pendiente' && <span className={'chip ' + a.estado}>{a.estado}</span>}
            {a.decision && !a.procesada && <span className="chip">aplicando…</span>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{a.pregunta}</p>
          {a.estado === 'pendiente' && !a.decision && (
            <>
              <input placeholder="Nota opcional para el agente (ej: cambia el gancho, baja a 5 clips…)" value={nota[a.id] || ''} onChange={e => setNota({ ...nota, [a.id]: e.target.value })} />
              <div className="fila" style={{ marginTop: 6 }}>
                {(a.opciones || []).length > 2
                  ? (a.opciones || []).map(o => <button key={o.id} className="btn-sec" onClick={() => decidir(a, o.id)}>{o.label}</button>)
                  : <>
                    <button onClick={() => decidir(a, 'si')}>✅ Aprobar</button>
                    <button className="btn-sec" onClick={() => decidir(a, 'no')}>✕ Rechazar</button>
                  </>}
                {a.tarea && <a className="muted" style={{ marginLeft: 'auto' }} href={`https://oficina-49-12-251-2.sslip.io/IVA/issues/${a.tarea}`} target="_blank" rel="noreferrer">ver detalle en Paperclip ↗</a>}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
