import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({ nombre: '', slug: '', tienda: '', carpeta_drive: '', brief: '' })
  const [sel, setSel] = useState(null)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const { data } = await supabase.from('productos').select('*').order('creado_en', { ascending: false })
    setProductos(data || [])
  }

  async function crear(e) {
    e.preventDefault()
    const slug = form.slug || form.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await supabase.from('productos').insert({ ...form, slug })
    setForm({ nombre: '', slug: '', tienda: '', carpeta_drive: '', brief: '' }); cargar()
  }

  async function guardarBrief() {
    await supabase.from('productos').update({ brief: sel.brief, carpeta_drive: sel.carpeta_drive, tienda: sel.tienda }).eq('id', sel.id)
    cargar()
  }

  return (
    <div className="productos">
      <form className="card" onSubmit={crear}>
        <h3>Nuevo producto</h3>
        <input placeholder="Nombre (ej: Busto Darth Vader humo)" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
        <input placeholder="Tienda (ZYRA, ARACHYX, Dorothy Resins…)" value={form.tienda} onChange={e => setForm({ ...form, tienda: e.target.value })} />
        <input placeholder="Enlace a la carpeta de Drive (OFICINA/productos/…)" value={form.carpeta_drive} onChange={e => setForm({ ...form, carpeta_drive: e.target.value })} />
        <button>Crear</button>
      </form>

      <div className="lista-productos">
        {productos.map(p => (
          <div key={p.id} className={'tarjeta ' + (sel?.id === p.id ? 'activo' : '')} onClick={() => setSel(p)}>
            <b>{p.nombre}</b>
            <div className="muted">{p.tienda || 'sin tienda'} · {p.slug}</div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="card detalle">
          <h3>{sel.nombre}</h3>
          <label>Tienda <input value={sel.tienda || ''} onChange={e => setSel({ ...sel, tienda: e.target.value })} /></label>
          <label>Carpeta Drive <input value={sel.carpeta_drive || ''} onChange={e => setSel({ ...sel, carpeta_drive: e.target.value })} /></label>
          <label>Brief (memoria compartida: todos los agentes lo leen y lo amplían)
            <textarea rows={12} value={sel.brief || ''} onChange={e => setSel({ ...sel, brief: e.target.value })} />
          </label>
          <button onClick={guardarBrief}>Guardar</button>
        </div>
      )}
    </div>
  )
}
