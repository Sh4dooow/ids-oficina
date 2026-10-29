import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Gastos reales: lo que cobra la API de Anthropic por cada ejecución (lo reporta Paperclip)
// y los créditos de Higgsfield que Iván ha aprobado por tarea.
const USD_EUR = 0.92
const eur = v => (v * USD_EUR).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const usd = v => '$' + v.toFixed(2)

const NOMBRE = { tiendas: 'Creador 2', creador: 'Creador', editor: 'Editor', jefe: 'Jefe' }

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [aprob, setAprob] = useState([])
  const [tareas, setTareas] = useState([])
  const [rango, setRango] = useState('mes')

  useEffect(() => {
    const d = new Date(); d.setDate(d.getDate() - 60)
    Promise.all([
      supabase.from('gastos').select('*').gte('creado_en', d.toISOString()).order('creado_en', { ascending: false }),
      supabase.from('aprobaciones').select('tarea,creditos,decision').eq('decision', 'si'),
      supabase.from('tareas').select('paperclip_identifier,titulo,fase,asignado_a'),
    ]).then(([g, a, t]) => { setGastos(g.data || []); setAprob(a.data || []); setTareas(t.data || []) })
  }, [])

  const desde = useMemo(() => {
    const h = new Date()
    if (rango === 'hoy') { h.setHours(0, 0, 0, 0); return h }
    if (rango === 'semana') { h.setDate(h.getDate() - 7); return h }
    if (rango === 'mes') { h.setDate(1); h.setHours(0, 0, 0, 0); return h }
    return new Date(0)
  }, [rango])

  const filtrados = gastos.filter(g => new Date(g.creado_en) >= desde)
  const total = filtrados.reduce((s, g) => s + Number(g.usd), 0)
  const hoy = gastos.filter(g => new Date(g.creado_en).toDateString() === new Date().toDateString()).reduce((s, g) => s + Number(g.usd), 0)
  const porAgente = {}
  for (const g of filtrados) porAgente[g.agente_id || '?'] = (porAgente[g.agente_id || '?'] || 0) + Number(g.usd)
  const creditosPorTarea = {}
  for (const a of aprob) creditosPorTarea[a.tarea] = (creditosPorTarea[a.tarea] || 0) + Number(a.creditos || 0)

  const porTarea = {}
  for (const g of filtrados) {
    const k = g.tarea_identifier || 'sin tarea (despertares sueltos)'
    porTarea[k] = porTarea[k] || { id: k, titulo: g.tarea_titulo, usd: 0, runs: 0, agentes: new Set(), ultimo: g.creado_en }
    porTarea[k].usd += Number(g.usd); porTarea[k].runs++; if (g.agente_id) porTarea[k].agentes.add(g.agente_id)
  }
  const lista = Object.values(porTarea).sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo))
  const tituloDe = id => tareas.find(t => t.paperclip_identifier === id)?.titulo?.replace(/^IVA-\d+ · /, '') || ''
  const faseDe = id => tareas.find(t => t.paperclip_identifier === id)?.fase
  const videos = tareas.filter(t => t.fase === 'terminada' && /video \d+/.test(t.titulo || '')).length
  const totalMes = gastos.filter(g => { const d = new Date(g.creado_en); const h = new Date(); return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear() }).reduce((s, g) => s + Number(g.usd), 0)

  return (
    <div className="gastos">
      <h2>💶 Gastos reales</h2>
      <p className="muted">Dinero que cobra la API de Anthropic por el trabajo de los agentes (lo que de verdad se factura, ejecución a ejecución). Los créditos de Higgsfield van aparte: se muestran los que has aprobado por tarea.</p>

      <div className="gastos-tiles">
        <div className="tile"><small>Hoy</small><b>{eur(hoy)}</b><span className="muted">{usd(hoy)}</span></div>
        <div className="tile"><small>Este mes</small><b>{eur(totalMes)}</b><span className="muted">{usd(totalMes)}</span></div>
        <div className="tile"><small>Vídeos terminados</small><b>{videos}</b><span className="muted">{videos ? eur(totalMes / videos) + ' por vídeo (mes)' : '—'}</span></div>
        <div className="tile"><small>Ejecuciones</small><b>{filtrados.length}</b><span className="muted">{filtrados.length ? eur(total / filtrados.length) + ' cada una' : '—'}</span></div>
      </div>

      <div className="fila" style={{ gap: 8, margin: '12px 0' }}>
        {[['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['todo', 'Todo']].map(([k, n]) => <button key={k} className={'btn-sec ' + (rango === k ? 'activo' : '')} onClick={() => setRango(k)}>{n}</button>)}
        <span className="espacio" /><b>Total {rango === 'todo' ? '' : 'del periodo'}: {eur(total)} <span className="muted">({usd(total)})</span></b>
      </div>

      <h3>Por agente</h3>
      <div className="gastos-agentes">
        {Object.entries(porAgente).sort((a, b) => b[1] - a[1]).map(([a, v]) => (
          <div key={a} className="tile"><small>{NOMBRE[a] || a}</small><b>{eur(v)}</b><span className="muted">{total ? Math.round(v / total * 100) : 0} %</span></div>
        ))}
      </div>

      <h3>Por tarea</h3>
      <table className="tabla-gastos">
        <thead><tr><th>Tarea</th><th>Estado</th><th>Ejecuciones</th><th>API</th><th>Créditos Higgsfield</th></tr></thead>
        <tbody>
          {lista.map(t => (
            <tr key={t.id}>
              <td><b>{t.id}</b> <span className="muted">{tituloDe(t.id) || t.titulo}</span></td>
              <td>{faseDe(t.id) === 'terminada' ? '✅' : faseDe(t.id) ? '⏳' : ''}</td>
              <td>{t.runs} <span className="muted">({[...t.agentes].map(x => NOMBRE[x] || x).join(', ')})</span></td>
              <td><b>{eur(t.usd)}</b> <span className="muted">{usd(t.usd)}</span></td>
              <td>{creditosPorTarea[t.id] ? creditosPorTarea[t.id] + ' cr' : <span className="muted">—</span>}</td>
            </tr>
          ))}
          {lista.length === 0 && <tr><td colSpan={5} className="muted">Sin gastos en este periodo.</td></tr>}
        </tbody>
      </table>
      <p className="muted">Cambio usado: 1 $ = {USD_EUR} €. El coste exacto en tu factura de Anthropic puede variar unos céntimos.</p>
    </div>
  )
}
