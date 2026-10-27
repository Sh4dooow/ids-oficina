import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OPCIONES, APARIENCIA_DEFECTO, previsualizar } from '../game/personaje.js'

// Panel para cambiar el aspecto y el nombre de un agente. Se guarda en Supabase y la oficina lo refleja al momento.
export default function Personalizar({ agente, onGuardado }) {
  const [ap, setAp] = useState({ ...APARIENCIA_DEFECTO, ...(agente.apariencia || {}) })
  const [nombre, setNombre] = useState(agente.nombre)
  const [dir, setDir] = useState('down')
  const [guardando, setGuardando] = useState(false)
  const canvas = useRef(null)

  useEffect(() => { setAp({ ...APARIENCIA_DEFECTO, ...(agente.apariencia || {}) }); setNombre(agente.nombre) }, [agente.id])
  useEffect(() => { if (canvas.current) previsualizar(canvas.current, ap, dir) }, [ap, dir])

  async function guardar() {
    setGuardando(true)
    await supabase.from('agentes').update({ apariencia: ap, nombre: nombre.trim() || agente.nombre, color: ap.ropa_color }).eq('id', agente.id)
    setGuardando(false); onGuardado?.()
  }
  const set = (k, v) => setAp(a => ({ ...a, [k]: v }))
  const aleatorio = () => {
    const pick = o => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)] }
    setAp({ piel: pick(OPCIONES.piel), pelo: pick(OPCIONES.pelo), pelo_color: pick(OPCIONES.pelo_color), ropa: pick(OPCIONES.ropa), accesorio: pick(OPCIONES.accesorio), ropa_color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') })
  }

  return (
    <div className="personalizar">
      <div className="preview">
        <canvas ref={canvas} />
        <div className="fila" style={{ justifyContent: 'center', gap: 4 }}>
          {['down', 'left', 'right', 'up'].map(d => <button key={d} className={'link ' + (dir === d ? 'activo' : '')} onClick={() => setDir(d)}>{{ down: '↓', left: '←', right: '→', up: '↑' }[d]}</button>)}
        </div>
      </div>
      <label>Nombre <input value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>Piel
        <div className="muestras">{Object.entries(OPCIONES.piel).map(([k, c]) => <button key={k} className={'muestra ' + (ap.piel === k ? 'activo' : '')} style={{ background: c }} onClick={() => set('piel', k)} title={k} />)}</div>
      </label>
      <label>Pelo
        <select value={ap.pelo} onChange={e => set('pelo', e.target.value)}>{Object.entries(OPCIONES.pelo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="muestras">{Object.entries(OPCIONES.pelo_color).map(([k, c]) => <button key={k} className={'muestra ' + (ap.pelo_color === k ? 'activo' : '')} style={{ background: c }} onClick={() => set('pelo_color', k)} title={k} />)}</div>
      </label>
      <label>Ropa
        <div className="fila">
          <select value={ap.ropa} onChange={e => set('ropa', e.target.value)}>{Object.entries(OPCIONES.ropa).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input type="color" value={ap.ropa_color} onChange={e => set('ropa_color', e.target.value)} style={{ width: 48, padding: 2 }} />
        </div>
      </label>
      <label>Accesorio
        <select value={ap.accesorio} onChange={e => set('accesorio', e.target.value)}>{Object.entries(OPCIONES.accesorio).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </label>
      <div className="fila">
        <button className="btn-sec" type="button" onClick={aleatorio}>🎲 Aleatorio</button>
        <span className="espacio" />
        <button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}
