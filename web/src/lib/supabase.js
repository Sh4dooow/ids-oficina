import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export const ESTADOS = [
  { id: 'pendiente', nombre: 'Pendiente', agente: 'jefe' },
  { id: 'tienda', nombre: 'Tienda', agente: 'tiendas' },
  { id: 'video', nombre: 'Vídeo', agente: 'creador' },
  { id: 'edicion', nombre: 'Edición', agente: 'editor' },
  { id: 'listo', nombre: 'Listo para subir', agente: null },
]
