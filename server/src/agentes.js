import Anthropic from '@anthropic-ai/sdk'
import { db, PIPELINE, log, decir, estadoAgente } from './db.js'

const claude = new Anthropic()
const MODELO = process.env.MODELO || 'claude-sonnet-4-5'

const BASE = `Eres un empleado de la oficina virtual de IVÁN DIGITAL STUDIO, la empresa de dropshipping orgánico de Iván.
Hablas en español, directo y sin relleno. Trabajas con el conocimiento que te han enseñado en la Escuela (abajo).
Si una lección contradice tu intuición, manda la lección: es lo que Iván quiere.
Cuando termines, escribe tu entrega con este formato exacto al final:

=== ENTREGA ===
<resumen de lo hecho, archivos/enlaces, y lo que el siguiente compañero necesita saber>
=== BRIEF ===
<líneas nuevas para añadir al brief del producto, o "nada">`

const EXTRA = {
  jefe: `Eres el JEFE. No ejecutas tareas: las entiendes, las descompones y las asignas.
Columnas disponibles: tienda (agente tiendas), video (agente creador), edicion (agente editor), listo.
Responde SIEMPRE con un JSON al final, dentro de === DECISION ===:
{"columna":"tienda|video|edicion|listo","titulo":"título corto","instrucciones":"qué tiene que hacer exactamente el agente","respuesta_ivan":"una frase para Iván"}`,
}

// Monta el "cerebro" del agente: base + lecciones activas de la Escuela
export async function construirSistema(agenteId) {
  const { data: lecciones } = await db.from('lecciones').select('titulo, contenido, tipo')
    .eq('agente_id', agenteId).eq('activa', true).order('orden').order('creado_en')
  const escuela = (lecciones || []).map(l => `## [${l.tipo}] ${l.titulo}\n${l.contenido}`).join('\n\n')
  return `${BASE}\n\n${EXTRA[agenteId] || ''}\n\n# LO QUE TE HAN ENSEÑADO EN LA ESCUELA\n${escuela || '(todavía nada: pide a Iván que te enseñe en la Escuela)'}`
}

async function contextoTarea(tarea) {
  let ctx = `# TAREA\nTítulo: ${tarea.titulo}\nDetalles: ${tarea.descripcion || '-'}\nEstado actual: ${tarea.estado}`
  if (tarea.producto_id) {
    const { data: p } = await db.from('productos').select('*').eq('id', tarea.producto_id).single()
    if (p) ctx += `\n\n# PRODUCTO\nNombre: ${p.nombre}\nTienda: ${p.tienda || '-'}\nCarpeta Drive: ${p.carpeta_drive || '-'}\n\n## Brief (memoria compartida)\n${p.brief || '(vacío)'}`
  }
  const { data: msgs } = await db.from('mensajes').select('de, para, contenido').eq('tarea_id', tarea.id).order('creado_en')
  if (msgs?.length) ctx += `\n\n# CONVERSACIÓN DE ESTA TAREA\n` + msgs.map(m => `${m.de} → ${m.para || 'todos'}: ${m.contenido}`).join('\n')
  return ctx
}

async function pensar(agenteId, tarea, extraUsuario = '') {
  const system = await construirSistema(agenteId)
  const user = (await contextoTarea(tarea)) + (extraUsuario ? `\n\n${extraUsuario}` : '')
  const r = await claude.messages.create({ model: MODELO, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] })
  return r.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
}

function seccion(texto, nombre) {
  const m = texto.match(new RegExp(`=== ${nombre} ===\\s*([\\s\\S]*?)(?==== |$)`))
  return m ? m[1].trim() : ''
}

// ---------- EL JEFE decide a dónde va una tarea ----------
export async function jefeAsigna(tarea) {
  await estadoAgente('jefe', 'trabajando')
  await log('jefe', 'recibe_tarea', tarea.titulo, tarea.id)
  try {
    const texto = await pensar('jefe', tarea)
    let decision = {}
    try { decision = JSON.parse(seccion(texto, 'DECISION').replace(/```json|```/g, '')) } catch { /* sin json */ }
    const columna = PIPELINE[decision.columna] ? decision.columna : 'video'
    const agente = PIPELINE[columna].agente
    await decir('jefe', agente, decision.instrucciones || texto, tarea.id)
    if (decision.respuesta_ivan) await decir('jefe', 'ivan', decision.respuesta_ivan, tarea.id)
    await db.from('tareas').update({ estado: columna, asignado_a: agente, titulo: decision.titulo || tarea.titulo }).eq('id', tarea.id)
    await log('jefe', 'asigna', `→ ${agente} (${columna})`, tarea.id)
  } catch (e) {
    await decir('jefe', 'ivan', `No he podido asignar la tarea: ${e.message}`, tarea.id, 'sistema')
    console.error(e)
  } finally {
    await estadoAgente('jefe', 'libre')
  }
}

// ---------- EL JEFE responde a un mensaje tuyo sin tarea ----------
export async function jefeConversa(mensaje) {
  await estadoAgente('jefe', 'trabajando')
  try {
    const system = await construirSistema('jefe')
    const { data: productos } = await db.from('productos').select('id, nombre, slug')
    const user = `Iván te dice (por ${mensaje.tipo === 'audio' ? 'audio transcrito' : 'texto'}): "${mensaje.contenido}"

Productos existentes: ${JSON.stringify(productos || [])}

Si es una orden de trabajo, crea la tarea: responde con === DECISION === y un JSON:
{"crear_tarea":true,"titulo":"...","descripcion":"...","producto_id":"id existente o null","columna":"tienda|video|edicion","respuesta_ivan":"..."}
Si solo es una pregunta o charla, responde con {"crear_tarea":false,"respuesta_ivan":"..."}`
    const r = await claude.messages.create({ model: MODELO, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] })
    const texto = r.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    let d = {}
    try { d = JSON.parse(seccion(texto, 'DECISION').replace(/```json|```/g, '')) } catch { d = { respuesta_ivan: texto } }

    if (d.crear_tarea) {
      const columna = PIPELINE[d.columna] ? d.columna : 'video'
      const { data: t } = await db.from('tareas').insert({
        titulo: d.titulo, descripcion: d.descripcion, producto_id: d.producto_id || null,
        estado: columna, asignado_a: PIPELINE[columna].agente, origen: mensaje.tipo === 'audio' ? 'telegram' : 'jefe',
      }).select().single()
      await decir('jefe', PIPELINE[columna].agente, d.descripcion, t.id)
      await log('jefe', 'crea_tarea', `${d.titulo} → ${columna}`, t.id)
    }
    await decir('jefe', 'ivan', d.respuesta_ivan || 'Hecho.')
    return d.respuesta_ivan
  } finally {
    await estadoAgente('jefe', 'libre')
  }
}

// ---------- UN AGENTE trabaja su columna ----------
// AQUÍ es donde luego enchufamos herramientas reales (Shopify, Higgsfield, Drive, ffmpeg)
// con el Claude Agent SDK / MCP. De momento el agente razona y entrega texto.
export async function agenteTrabaja(agenteId, tarea) {
  await estadoAgente(agenteId, 'trabajando')
  await log(agenteId, 'empieza', tarea.titulo, tarea.id)
  try {
    const texto = await pensar(agenteId, tarea, 'Haz tu parte de esta tarea ahora.')
    const entrega = seccion(texto, 'ENTREGA') || texto
    const brief = seccion(texto, 'BRIEF')

    const siguiente = PIPELINE[tarea.estado].siguiente
    const sigAgente = siguiente ? PIPELINE[siguiente].agente : null
    await decir(agenteId, sigAgente || 'ivan', entrega, tarea.id, 'resultado')

    if (brief && brief.toLowerCase() !== 'nada' && tarea.producto_id) {
      const { data: p } = await db.from('productos').select('brief').eq('id', tarea.producto_id).single()
      await db.from('productos').update({ brief: `${p?.brief || ''}\n\n### ${agenteId} · ${new Date().toLocaleDateString('es-ES')}\n${brief}`.trim() }).eq('id', tarea.producto_id)
    }

    const { data: t } = await db.from('tareas').select('resultado').eq('id', tarea.id).single()
    await db.from('tareas').update({
      estado: siguiente || tarea.estado, asignado_a: sigAgente,
      resultado: { ...(t?.resultado || {}), [agenteId]: entrega },
    }).eq('id', tarea.id)
    await log(agenteId, 'entrega', siguiente ? `→ ${siguiente}` : 'fin', tarea.id)
    if (siguiente === 'listo') await decir('jefe', 'ivan', `✅ "${tarea.titulo}" está en LISTO. Descárgalo de la carpeta del producto y súbelo cuando quieras.`, tarea.id)
  } catch (e) {
    await decir(agenteId, 'jefe', `Me he atascado: ${e.message}`, tarea.id, 'sistema')
    console.error(e)
  } finally {
    await estadoAgente(agenteId, 'libre')
  }
}
