import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import VideoTarea from './VideoTarea.jsx'

// 🎓 Enseñar: Iván opina (por voz o escrito) sobre un vídeo terminado — lo que está bien y lo que hay que mejorar —
// y eso se convierte en una lección que TODOS los agentes leen antes de hacer el siguiente vídeo.
// Puede ser general (todos los productos) o solo de un producto.
export default function Ensenar({ videoInicial, onCerrar }) {
  const [videos, setVideos] = useState([])
  const [productos, setProductos] = useState([])
  const [video, setVideo] = useState(videoInicial || null)
  const [veredicto, setVeredicto] = useState('mejorar')   // 'bien' | 'mejorar'
  const [alcance, setAlcance] = useState('todos')          // 'todos' | 'producto'
  const [producto, setProducto] = useState('')
  const [texto, setTexto] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const recRef = useRef(null)
  const soportaVoz = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    supabase.from('avisos').select('id,titulo,texto,video_url,creado_en').not('video_url', 'is', null).order('creado_en', { ascending: false }).limit(40)
      .then(({ data }) => setVideos(data || []))
    supabase.from('productos').select('slug,nombre').then(({ data }) => setProductos(data || []))
    return () => { try { recRef.current?.stop() } catch {} }
  }, [])

  useEffect(() => {
    // deducir el producto del vídeo elegido (la URL lleva /<producto>/videos/)
    const m = video?.video_url?.match(/\/([^/]+)\/(videos|final)\//)
    if (m) setProducto(decodeURIComponent(m[1]))
  }, [video])

  function hablar() {
    if (grabando) { recRef.current?.stop(); setGrabando(false); return }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new R(); r.lang = 'es-ES'; r.continuous = true; r.interimResults = true
    let base = texto ? texto.trim() + ' ' : ''
    r.onresult = (e) => {
      let fin = '', parcial = ''
      for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + ' '; else parcial += t }
      setTexto(base + fin + parcial)
    }
    r.onend = () => setGrabando(false)
    r.onerror = () => setGrabando(false)
    recRef.current = r; r.start(); setGrabando(true)
  }

  async function enviar() {
    const cuerpo = texto.trim(); if (!cuerpo) return
    const prod = alcance === 'producto' ? (producto || null) : null
    const titulo = (veredicto === 'bien' ? '👍 Así se hace' : '⚠️ A mejorar') + (video ? ` · ${video.titulo.replace(/^✅ Terminado — /, '')}` : '') + (prod ? ` (${prod})` : ' (todos los productos)')
    const contenido = (veredicto === 'bien' ? 'ESTO ESTÁ BIEN, repetidlo así: ' : 'ESTO HAY QUE MEJORARLO en los siguientes vídeos: ') + cuerpo + (video?.video_url ? `\nVídeo de referencia: ${video.video_url}` : '')
    await supabase.from('lecciones').insert({ agente_id: 'todos', titulo, contenido, tipo: veredicto === 'bien' ? 'ejemplo' : 'correccion', producto: prod, video_url: video?.video_url || null, origen: 'ivan', orden: 999 })
    setEnviado(true); setTimeout(() => onCerrar?.(), 1500)
  }

  return (
    <div className="modal" onClick={onCerrar}>
      <div className="card ensenar" onClick={e => e.stopPropagation()}>
        <div className="fila"><h3 style={{ margin: 0 }}>🎓 Enseñar a los agentes</h3><span className="espacio" /><button className="link" onClick={onCerrar}>✕</button></div>
        <p className="muted">Dile qué está bien y qué hay que mejorar. Lo leen todos (Jefe, Creador, Creador 2 y Editor) antes de cada vídeo nuevo. No se repite el vídeo: es para aprender.</p>

        <div className="ensenar-grid">
          <div>
            <label className="muted">Sobre qué vídeo</label>
            <select value={video?.id || ''} onChange={e => setVideo(videos.find(v => v.id === e.target.value) || null)}>
              <option value="">(ninguno en concreto — lección general)</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.titulo.replace(/^✅ Terminado — /, '')}</option>)}
            </select>
            {video && <VideoTarea url={video.video_url} />}
          </div>
          <div className="ensenar-opciones">
            <label className="muted">Veredicto</label>
            <div className="chips">
              <button className={'chip ' + (veredicto === 'bien' ? 'activo bien' : '')} onClick={() => setVeredicto('bien')}>👍 Está bien, así se hace</button>
              <button className={'chip ' + (veredicto === 'mejorar' ? 'activo mejorar' : '')} onClick={() => setVeredicto('mejorar')}>⚠️ Hay que mejorar</button>
            </div>
            <label className="muted">Vale para</label>
            <div className="chips">
              <button className={'chip ' + (alcance === 'todos' ? 'activo' : '')} onClick={() => setAlcance('todos')}>Todos los productos</button>
              <button className={'chip ' + (alcance === 'producto' ? 'activo' : '')} onClick={() => setAlcance('producto')}>Solo un producto</button>
            </div>
            {alcance === 'producto' && (
              <select value={producto} onChange={e => setProducto(e.target.value)}>
                <option value="">elige producto…</option>
                {productos.map(p => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
                {producto && !productos.some(p => p.slug === producto) && <option value={producto}>{producto}</option>}
              </select>
            )}
            <label className="muted">Tu explicación</label>
            <textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej.: El texto va perfecto y la música también. Para los siguientes, que la persona mire más a cámara y el fondo tenga más luz." />
            <div className="fila">
              {soportaVoz ? <button className={'btn-sec ' + (grabando ? 'grabando' : '')} onClick={hablar}>{grabando ? '⏹ Parar' : '🎙️ Hablar'}</button>
                : <span className="muted">Para hablar usa Chrome.</span>}
              <span className="espacio" />
              <button className="btn" disabled={!texto.trim() || enviado} onClick={enviar}>{enviado ? '✅ Aprendido' : '📚 Enseñar'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
