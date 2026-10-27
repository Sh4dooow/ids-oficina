import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Formulario de encargo: texto o audio + enlace de referencia + fotos del producto.
// Todo se guarda en Supabase; el puente del servidor transcribe el audio, descarga el vídeo
// de referencia y crea la tarea en Paperclip para el Jefe.
export default function NuevaTarea({ productos, onCreada }) {
  const [titulo, setTitulo] = useState('')
  const [detalles, setDetalles] = useState('')
  const [productoId, setProductoId] = useState('')
  const [url, setUrl] = useState('')
  const [fotos, setFotos] = useState([])
  const [grabando, setGrabando] = useState(false)
  const [audio, setAudio] = useState(null) // Blob
  const [segundos, setSegundos] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const rec = useRef(null), chunks = useRef([]), timer = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  async function empezarGrabacion() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const r = new MediaRecorder(stream, { mimeType: mime })
      chunks.current = []
      r.ondataavailable = e => e.data.size && chunks.current.push(e.data)
      r.onstop = () => { setAudio(new Blob(chunks.current, { type: 'audio/webm' })); stream.getTracks().forEach(t => t.stop()) }
      r.start(); rec.current = r; setGrabando(true); setSegundos(0)
      timer.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } catch (e) { alert('No puedo usar el micrófono: ' + e.message) }
  }
  function pararGrabacion() { rec.current?.stop(); setGrabando(false); clearInterval(timer.current) }

  async function enviar(e) {
    e.preventDefault()
    if (!titulo.trim() && !audio && !detalles.trim()) return
    setEnviando(true)
    try {
      const id = crypto.randomUUID()
      let audio_path = null, fotos_paths = []
      if (audio) {
        audio_path = `tareas/${id}/audio.webm`
        const { error } = await supabase.storage.from('adjuntos').upload(audio_path, audio, { contentType: 'audio/webm' })
        if (error) throw error
      }
      for (const f of fotos) {
        const p = `tareas/${id}/fotos/${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('adjuntos').upload(p, f, { contentType: f.type })
        if (error) throw error
        fotos_paths.push(p)
      }
      const { error } = await supabase.from('tareas').insert({
        id, titulo: titulo.trim() || (audio ? '🎙 Encargo por audio' : detalles.slice(0, 60)),
        descripcion: detalles.trim(), producto_id: productoId || null, origen: 'web', asignado_a: 'jefe',
        referencia_url: url.trim() || null, audio_path, fotos_paths,
      })
      if (error) throw error
      setTitulo(''); setDetalles(''); setUrl(''); setFotos([]); setAudio(null); setSegundos(0)
      onCreada?.()
    } catch (err) { alert('No se pudo enviar: ' + err.message) }
    setEnviando(false)
  }

  return (
    <form className="card nueva-tarea-form" onSubmit={enviar}>
      <h3>Nuevo encargo para el Jefe</h3>
      <div className="grid2">
        <input placeholder="Título (ej: Busto Vader — 2 vídeos replicando referencia)" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto (nuevo o sin elegir)</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <input placeholder="🔗 Enlace del vídeo de referencia (TikTok, Instagram, YouTube…) — se descarga solo a referencias/" value={url} onChange={e => setUrl(e.target.value)} />
      <textarea rows={4} value={detalles} onChange={e => setDetalles(e.target.value)}
        placeholder={'Detalles para el Jefe. Lo útil:\n• Qué producto es y para qué tienda (ZYRA, ARACHYX, Dorothy Resins…)\n• Cuántos vídeos / variantes quieres\n• Qué hay que copiar del vídeo de referencia y qué cambiar\n• Precio / compare-at si hay que tocar tienda\n• Para cuándo'} />
      <div className="fila audio-fila">
        {!grabando
          ? <button type="button" className="btn-sec" onClick={empezarGrabacion}>🎙 {audio ? 'Grabar otro audio' : 'Grabar audio'}</button>
          : <button type="button" className="btn-rec" onClick={pararGrabacion}>⏹ Parar ({segundos}s)</button>}
        {audio && !grabando && <><audio controls src={URL.createObjectURL(audio)} style={{ height: 32 }} /><button type="button" className="link" onClick={() => setAudio(null)}>quitar</button></>}
        <span className="espacio" />
        <label className="btn-sec" style={{ cursor: 'pointer' }}>📷 Fotos del producto
          <input type="file" accept="image/*" multiple hidden onChange={e => setFotos([...e.target.files])} />
        </label>
        {fotos.length > 0 && <span className="muted">{fotos.length} foto(s)</span>}
      </div>
      <div className="fila">
        <span className="muted">El audio se transcribe en el servidor, el enlace se descarga y las fotos van a la carpeta del producto. El Jefe lo reparte.</span>
        <span className="espacio" />
        <button disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar al Jefe'}</button>
      </div>
    </form>
  )
}
