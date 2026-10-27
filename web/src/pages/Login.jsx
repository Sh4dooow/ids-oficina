import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setCargando(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setCargando(false)
  }

  return (
    <div className="login">
      <form onSubmit={entrar} className="card">
        <h1>IVÁN DIGITAL STUDIO</h1>
        <p className="muted">Oficina virtual · acceso privado</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
