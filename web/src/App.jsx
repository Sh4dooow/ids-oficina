import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login.jsx'
import Oficina from './pages/Oficina.jsx'
import Tablero from './pages/Tablero.jsx'
import Escuela from './pages/Escuela.jsx'
import Productos from './pages/Productos.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="cargando">Cargando…</div>
  if (!session) return <Login />

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">IVÁN DIGITAL STUDIO <span>· Oficina</span></div>
        <nav>
          <NavLink to="/oficina">🏢 Oficina</NavLink>
          <NavLink to="/tablero">📋 Tablero</NavLink>
          <NavLink to="/productos">📦 Productos</NavLink>
          <NavLink to="/escuela">🎓 Escuela</NavLink>
        </nav>
        <a className="link" href="https://oficina-49-12-251-2.sslip.io" target="_blank" rel="noreferrer">⚙️ Paperclip</a>
        <button className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/oficina" replace />} />
          <Route path="/oficina" element={<Oficina />} />
          <Route path="/tablero" element={<Tablero />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/escuela" element={<Escuela />} />
        </Routes>
      </main>
    </div>
  )
}
