# Iván Digital Studio · Oficina virtual

Oficina en local con 4 empleados IA (Jefe, Tiendas, Creador, Editor), tablero de tareas,
Escuela para enseñarles y chat con el Jefe por web o Telegram. Base de datos: Supabase
(proyecto "Iván Digital Studio Oficina").

```
ids-oficina/
  web/      → la página (login, oficina animada, tablero, productos, escuela)
  server/   → el orquestador: agentes con Claude + bot de Telegram
  supabase/ → el SQL del esquema (ya aplicado en tu proyecto)
```

## Arrancar (primera vez)

### 1. Crear tu usuario de acceso
Supabase → Authentication → Users → "Add user" → tu email y una contraseña.
(Con eso te logueas en la web. Solo tú.)

### 2. La web
```bash
cd web
cp .env.example .env        # ya lleva la URL y la clave pública del proyecto
npm install
npm run dev                 # → http://localhost:5173
```

### 3. El servidor (los agentes)
```bash
cd server
cp .env.example .env
# rellena: SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
npm install
npm run dev
```

Claves:
- `SUPABASE_SERVICE_KEY`: Supabase → Project Settings → API Keys → service_role (secreta, solo en tu PC).
- `ANTHROPIC_API_KEY`: console.anthropic.com.
- `TELEGRAM_BOT_TOKEN`: en Telegram, habla con @BotFather → /newbot.
- `TELEGRAM_CHAT_ID`: escribe a @userinfobot y te lo da.
- `OPENAI_API_KEY` (opcional): solo para transcribir audios de Telegram.

## Cómo funciona

1. **Escuela** → eliges un empleado y le pegas su skill (tipo "Skill base"). Luego le vas
   añadiendo lecciones, correcciones y ejemplos. Desactivar una lección = la olvida.
   El botón "Ver el prompt completo" te enseña exactamente lo que recibe.
2. **Productos** → creas el producto, pones el enlace a su carpeta de Drive y el brief.
   El brief es la memoria compartida: cada agente lo lee y añade lo que descubre.
3. **Tablero** → creas una tarea (o se la dices al Jefe por chat/Telegram). El Jefe la
   lee y la manda a la columna que toca. Cada columna tiene su dueño:
   `Pendiente (Jefe) → Tienda (Tiendas) → Vídeo (Creador) → Edición (Editor) → Listo`.
   Arrastrar una tarjeta a una columna despierta a ese agente.
4. **Oficina** → ves a los empleados moverse: libre = deambulan, trabajando = en su mesa.
   A la derecha, el chat con el Jefe y el registro de actividad.
5. **Listo** → el Jefe te avisa (web + Telegram). Descargas de `final/` en Drive y subes tú.

## Drive
Carpeta `OFICINA` en tu Google Drive:
```
OFICINA/
  _contexto/           marcas, políticas, prompts fijos, estilo
  productos/
    _PLANTILLA/        copia esta carpeta por cada producto nuevo
      fotos/  referencias/  clips/  final/
```

## Siguiente paso (fase 2): manos para los agentes
Ahora mismo los agentes razonan y entregan texto (instrucciones, prompts, copys).
En `server/src/agentes.js` → `agenteTrabaja()` es donde se enchufan herramientas reales
con el Claude Agent SDK + MCP: Shopify (Tiendas), Higgsfield (Creador), ffmpeg + Drive
(Editor). Se hace agente a agente, empezando por el Creador.
