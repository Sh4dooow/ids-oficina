import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// Pipeline: qué agente trabaja en cada columna y a qué columna pasa después
export const PIPELINE = {
  pendiente: { agente: 'jefe', siguiente: null },      // el jefe decide
  tienda:    { agente: 'tiendas', siguiente: 'video' },
  video:     { agente: 'creador', siguiente: 'edicion' },
  edicion:   { agente: 'editor', siguiente: 'listo' },
  listo:     { agente: null, siguiente: null },
}

export async function log(agente_id, accion, detalle = '', tarea_id = null) {
  await db.from('actividad').insert({ agente_id, tarea_id, accion, detalle })
  console.log(`[${agente_id}] ${accion} ${detalle}`)
}

export async function decir(de, para, contenido, tarea_id = null, tipo = 'texto') {
  await db.from('mensajes').insert({ de, para, contenido, tarea_id, tipo })
}

export async function estadoAgente(id, estado) {
  await db.from('agentes').update({ estado }).eq('id', id)
}
