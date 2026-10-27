import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// LA ESCUELA. Eliges un agente y le das conocimiento.
// Cada lección es un bloque de markdown. El orquestador monta el prompt del agente
// con: skill_base + lecciones activas (en orden). Desactivar una lección = la olvida.
const TIPOS = {
  skill_base: 'Skill base (su conocimiento principal)',
  leccion: 'Lección nueva',
  correccion: 'Corrección ("esto hazlo así, no así")',
  ejemplo: 'Ejemplo de trabajo bien hecho',
}

export default function Escuela() {
  const [agentes, setAgentes] = useState([])
  const [agente, setAgente] = useState(null)
  const [lecciones, setLecciones] = useState([])
  const [form, setForm] = useState({ titulo: '', contenido: '', tipo: 'leccion' })
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    supabase.from('agentes').select('*').order('id').then(({ data }) => {
      setAgentes(data || []); if (data?.length) setAgente(data[0])
    })
  }, [])

  useEffect(() => { if (agente) cargar() }, [agente])

  async function cargar() {
    const { data } = await supabase.from('lecciones').select('*').eq('agente_id', agente.id).order('orden').order('creado_en')
    setLecciones(data || [])
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.contenido.trim()) return
    if (editando) {
      await supabase.from('lecciones').update(form).eq('id', editando)
    } else {
      await supabase.from('lecciones').insert({ ...form, agente_id: agente.id, orden: lecciones.length })
    }
    setForm({ titulo: '', contenido: '', tipo: 'leccion' }); setEditando(null); cargar()
  }

  async function toggle(l) { await supabase.from('lecciones').update({ activa: !l.activa }).eq('id', l.id); cargar() }
  async function borrar(l) { if (confirm('¿Borrar esta lección?')) { await supabase.from('lecciones').delete().eq('id', l.id); cargar() } }
  function editar(l) { setEditando(l.id); setForm({ titulo: l.titulo, contenido: l.contenido, tipo: l.tipo }) }

  const promptCompilado = lecciones.filter(l => l.activa).map(l => `## ${l.titulo}\n${l.contenido}`).join('\n\n')

  return (
    <div className="escuela">
      <aside className="pupitres">
        <h3>Alumnos</h3>
        {agentes.map(a => (
          <button key={a.id} className={'pupitre ' + (agente?.id === a.id ? 'activo' : '')} onClick={() => setAgente(a)}>
            <i style={{ background: a.color }} /> {a.nombre}<small>{a.rol}</small>
          </button>
        ))}
      </aside>

      {agente && (
        <section className="aula">
          <h2>🎓 Clase para <span style={{ color: agente.color }}>{agente.nombre}</span></h2>
          <p className="muted">{agente.descripcion}</p>

          <form className="card" onSubmit={guardar}>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Título (ej: Cómo nombrar los clips)" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            <textarea rows={10} placeholder="Pega aquí la skill, la lección o la corrección (markdown)…" value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} />
            <div className="fila">
              <button>{editando ? 'Guardar cambios' : 'Enseñar'}</button>
              {editando && <button type="button" className="link" onClick={() => { setEditando(null); setForm({ titulo: '', contenido: '', tipo: 'leccion' }) }}>Cancelar</button>}
            </div>
          </form>

          <h3>Lo que sabe ({lecciones.filter(l => l.activa).length} lecciones activas)</h3>
          {lecciones.map(l => (
            <div key={l.id} className={'leccion ' + (l.activa ? '' : 'inactiva')}>
              <div className="fila">
                <span className="chip">{l.tipo}</span><b>{l.titulo}</b>
                <span className="muted">{l.contenido.length} caracteres</span>
                <span className="espacio" />
                <button className="link" onClick={() => editar(l)}>Editar</button>
                <button className="link" onClick={() => toggle(l)}>{l.activa ? 'Desactivar' : 'Activar'}</button>
                <button className="link peligro" onClick={() => borrar(l)}>Borrar</button>
              </div>
            </div>
          ))}

          <details>
            <summary>Ver el prompt completo que recibe {agente.nombre}</summary>
            <pre className="resultado">{promptCompilado || '(todavía no sabe nada)'}</pre>
          </details>
        </section>
      )}
    </div>
  )
}
