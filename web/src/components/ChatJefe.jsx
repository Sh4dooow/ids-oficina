import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Hablas con el Jefe. Lo que escribes se guarda en `mensajes` (de: ivan, para: jefe).
// El orquestador (server/) lo lee, el Jefe decide y responde en la misma tabla.
export default function ChatJefe() {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const fin = useRef(null)

  useEffect(() => {
    cargar()
    const ch = supabase.channel('chat-jefe')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (p) => {
        if (p.new.de === 'ivan' || p.new.para === 'ivan' || p.new.de === 'jefe') setMensajes(m => [...m, p.new])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function cargar() {
    const { data } = await supabase.from('mensajes').select('*')
      .or('de.eq.ivan,para.eq.ivan,de.eq.jefe').order('creado_en').limit(50)
    setMensajes(data || [])
  }

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    await supabase.from('mensajes').insert({ de: 'ivan', para: 'jefe', contenido: texto.trim(), tipo: 'texto' })
    setTexto('')
  }

  return (
    <div className="chat">
      <h3>Hablar con el Jefe</h3>
      <div className="chat-mensajes">
        {mensajes.map(m => (
          <div key={m.id} className={'burbuja ' + (m.de === 'ivan' ? 'yo' : 'agente')}>
            <small>{m.de}</small>{m.contenido}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar}>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: nuevo producto, busto de Vader, quiero 3 vídeos…" />
        <button>Enviar</button>
      </form>
    </div>
  )
}
