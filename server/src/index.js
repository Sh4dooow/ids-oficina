import { db, PIPELINE } from './db.js'
import { jefeAsigna, jefeConversa, agenteTrabaja } from './agentes.js'
import { arrancarTelegram, avisar } from './telegram.js'

// ORQUESTADOR. Escucha Supabase en tiempo real:
//  - tarea nueva o movida de columna  -> despierta al agente de esa columna
//  - mensaje tuyo al jefe (desde la web) -> el jefe contesta / crea tarea
// Nunca procesa dos veces la misma tarea a la vez.

const enCurso = new Set()
const bot = arrancarTelegram()

async function despachar(tarea) {
  if (!tarea || enCurso.has(tarea.id)) return
  const col = PIPELINE[tarea.estado]
  if (!col?.agente) return
  enCurso.add(tarea.id)
  try {
    if (tarea.estado === 'pendiente') await jefeAsigna(tarea)
    else await agenteTrabaja(col.agente, tarea)
    const { data: t } = await db.from('tareas').select('*').eq('id', tarea.id).single()
    if (t?.estado === 'listo') await avisar(bot, `✅ Listo para subir: ${t.titulo}`)
  } finally {
    enCurso.delete(tarea.id)
  }
}

db.channel('orquestador')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tareas' }, p => despachar(p.new))
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tareas' }, p => {
    if (p.old?.estado !== p.new.estado) despachar(p.new) // solo cuando cambia de columna
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, p => {
    const m = p.new
    if (m.de === 'ivan' && m.para === 'jefe' && !m.tarea_id && m.tipo === 'texto') jefeConversa(m)
  })
  .subscribe(status => console.log('[orquestador] realtime:', status))

// Al arrancar, recoge lo que quedó a medias
const { data: pendientes } = await db.from('tareas').select('*').neq('estado', 'listo')
for (const t of pendientes || []) despachar(t)

console.log('🏢 Oficina de Iván Digital Studio en marcha')
