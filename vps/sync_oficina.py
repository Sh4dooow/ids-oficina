#!/usr/bin/env python3
"""
Puente Oficina virtual (Supabase/web) <-> Paperclip (agentes).
Corre en el VPS cada pocos segundos.

Paperclip -> Supabase:  estado de agentes, tareas (issues), comentarios, actividad
Supabase  -> Paperclip: tareas nuevas creadas en la web, mensajes de Iván al Jefe,
                        lecciones de la Escuela -> AGENTS.md de cada agente
"""
import os, time, json, subprocess, sys, traceback, re
import psycopg2, psycopg2.extras, requests

ENV = {}
for line in open("/root/oficina.env"):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1); ENV[k] = v

SB_URL = ENV["SUPABASE_URL"]; SB_KEY = ENV["SUPABASE_ANON_KEY"]
SB_EMAIL = ENV["SUPABASE_SYNC_EMAIL"]; SB_PASS = ENV["SUPABASE_SYNC_PASSWORD"]
COMPANY = ENV["PAPERCLIP_COMPANY_ID"]; JEFE_KEY = ENV["PAPERCLIP_JEFE_KEY"]
AG_BASE = f"/home/oficina/.paperclip/instances/default/companies/{COMPANY}/agents"
ROLES_DIR = "/home/oficina/oficina/agentes"

AGENTES = {"Jefe": "jefe", "Tiendas": "tiendas", "Creador": "creador", "Editor": "editor"}
COLUMNA = {"jefe": "pendiente", "tiendas": "tienda", "creador": "video", "editor": "edicion"}

# ---------- Supabase (REST con login de usuario) ----------
class SB:
    def __init__(s):
        s.tok = None; s.exp = 0
    def login(s):
        r = requests.post(f"{SB_URL}/auth/v1/token?grant_type=password",
                          headers={"apikey": SB_KEY, "Content-Type": "application/json"},
                          json={"email": SB_EMAIL, "password": SB_PASS}, timeout=20)
        r.raise_for_status(); d = r.json(); s.tok = d["access_token"]; s.exp = time.time() + d.get("expires_in", 3600) - 120
    def h(s):
        if not s.tok or time.time() > s.exp: s.login()
        return {"apikey": SB_KEY, "Authorization": f"Bearer {s.tok}", "Content-Type": "application/json", "Prefer": "return=representation"}
    def get(s, table, q=""):
        r = requests.get(f"{SB_URL}/rest/v1/{table}?{q}", headers=s.h(), timeout=20); r.raise_for_status(); return r.json()
    def upsert(s, table, rows, on="id"):
        if not rows: return []
        h = s.h(); h["Prefer"] = f"resolution=merge-duplicates,return=representation"
        r = requests.post(f"{SB_URL}/rest/v1/{table}?on_conflict={on}", headers=h, data=json.dumps(rows), timeout=20)
        if r.status_code >= 300: print("upsert", table, r.status_code, r.text[:300]); return []
        return r.json()
    def patch(s, table, q, data):
        r = requests.patch(f"{SB_URL}/rest/v1/{table}?{q}", headers=s.h(), data=json.dumps(data), timeout=20)
        if r.status_code >= 300: print("patch", table, r.status_code, r.text[:300])
    def insert(s, table, row):
        r = requests.post(f"{SB_URL}/rest/v1/{table}", headers=s.h(), data=json.dumps(row), timeout=20)
        if r.status_code >= 300: print("insert", table, r.status_code, r.text[:300]); return None
        return r.json()[0] if r.json() else None

sb = SB()
pg = psycopg2.connect(host="127.0.0.1", port=54329, user="paperclip", password="paperclip", dbname="paperclip")
pg.autocommit = True

OFICINA = "/home/oficina/oficina/OFICINA"
WHISPER_PY = "/opt/whisper/bin/python"; YTDLP = "/opt/whisper/bin/yt-dlp"

def tg(texto):
    """Aviso a Iván por Telegram desde el bot del Jefe."""
    try:
        requests.post(f"https://api.telegram.org/bot{ENV['TELEGRAM_BOT_TOKEN']}/sendMessage",
                      json={"chat_id": ENV["TELEGRAM_CHAT_ID"], "text": texto}, timeout=20)
    except Exception as e: print("telegram:", e)

def sb_download(path, dest):
    r = requests.get(f"{SB_URL}/storage/v1/object/adjuntos/{path}", headers=sb.h(), timeout=120)
    r.raise_for_status(); os.makedirs(os.path.dirname(dest), exist_ok=True); open(dest, "wb").write(r.content); return dest

def transcribir(path):
    code = ("from faster_whisper import WhisperModel;import sys;m=WhisperModel('small',device='cpu',compute_type='int8');"
            "segs,_=m.transcribe(sys.argv[1],language='es',vad_filter=True);print(' '.join(s.text.strip() for s in segs))")
    r = subprocess.run([WHISPER_PY, "-c", code, path], capture_output=True, text=True, timeout=900)
    return r.stdout.strip()

def descargar_referencia(url, carpeta):
    os.makedirs(carpeta, exist_ok=True)
    r = subprocess.run([YTDLP, "-o", os.path.join(carpeta, "ref_%(id)s.%(ext)s"), "--no-playlist", "-f", "mp4/best", "--print", "after_move:filepath", url],
                       capture_output=True, text=True, timeout=600)
    out = r.stdout.strip().splitlines()
    return out[-1] if out else None

def carpeta_producto(t):
    """La carpeta del producto es su carpeta en el Drive de Iván (OFICINA/<carpeta_drive>)."""
    if t.get("producto_id"):
        p = sb.get("productos", f"id=eq.{t['producto_id']}&select=slug,carpeta_drive,nombre")
        if p:
            c = (p[0].get("carpeta_drive") or "").strip()
            if c and not c.startswith("http"): return os.path.join(OFICINA, c)
            return os.path.join(OFICINA, p[0]["slug"])
    return os.path.join(OFICINA, "_entrantes", t["id"][:8])

def q(sql, *a):
    with pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
        c.execute(sql, a); return c.fetchall()

def agente_slug(agent_id, ids):
    return ids.get(agent_id)

def mapa_estado(issue, slug):
    st = issue["status"]
    if st in ("done",): return "listo"
    if st in ("cancelled", "canceled"): return None
    return COLUMNA.get(slug or "jefe", "pendiente")

def cli(*args):
    env = dict(os.environ, PATH="/home/oficina/.local/bin:/home/oficina/.npm-global/bin:" + os.environ.get("PATH", ""))
    return subprocess.run(["sudo", "-u", "oficina", "-H", "env", f"PATH={env['PATH']}", "paperclipai", *args],
                          capture_output=True, text=True, cwd="/home/oficina", timeout=120)

# ---------- Paperclip -> Supabase ----------
def sync_agentes(ids):
    rows = []
    for a in q("select id,name,status from agents"):
        slug = AGENTES.get(a["name"]);
        if not slug: continue
        est = "trabajando" if a["status"] in ("running", "working", "active") else "libre"
        rows.append({"id": slug, "estado": est})
    for r in rows: sb.patch("agentes", f"id=eq.{r['id']}", {"estado": r["estado"]})

def sync_tareas(ids):
    issues = q("select id,identifier,title,description,status,assignee_agent_id,created_at,updated_at from issues order by created_at")
    rows = []
    for i in issues:
        slug = ids.get(i["assignee_agent_id"])
        est = mapa_estado(i, slug)
        if est is None: continue
        rows.append({"paperclip_id": i["id"], "paperclip_identifier": i["identifier"], "titulo": f"{i['identifier']} · {i['title']}",
                     "descripcion": (i["description"] or "")[:4000], "estado": est, "asignado_a": slug, "origen": "paperclip"})
    pendientes = {t["paperclip_id"] for t in sb.get("tareas", "mover_a=not.is.null&select=paperclip_id")}
    rows = [r for r in rows if r["paperclip_id"] not in pendientes]
    sb.upsert("tareas", rows, on="paperclip_id")
    # cancelados -> borrar del tablero
    canc = [i["id"] for i in issues if i["status"] in ("cancelled", "canceled")]
    for cid in canc: requests.delete(f"{SB_URL}/rest/v1/tareas?paperclip_id=eq.{cid}", headers=sb.h(), timeout=20)

def sync_comentarios(ids, tarea_ids):
    coms = q("select c.id,c.issue_id,c.body,c.author_agent_id,c.author_user_id,c.created_at from issue_comments c order by c.created_at desc limit 200")
    rows = []
    for c in coms:
        tid = tarea_ids.get(c["issue_id"])
        if not tid or not c["body"]: continue
        de = ids.get(c["author_agent_id"]) or ("ivan" if c["author_user_id"] else "sistema")
        rows.append({"paperclip_id": c["id"], "tarea_id": tid, "de": de, "para": None, "contenido": c["body"][:4000], "tipo": "resultado" if de != "ivan" else "texto"})
    sb.upsert("mensajes", rows, on="paperclip_id")

def sync_actividad(ids, tarea_ids):
    try:
        runs = q("select id,agent_id,issue_id,status,created_at from heartbeat_runs order by created_at desc limit 50")
    except Exception: return
    rows = [{"paperclip_id": r["id"], "agente_id": ids.get(r["agent_id"]), "tarea_id": tarea_ids.get(r["issue_id"]),
             "accion": {"running": "empieza", "succeeded": "entrega", "failed": "falla"}.get(r["status"], r["status"]), "detalle": ""}
            for r in runs if ids.get(r["agent_id"])]
    sb.upsert("actividad", rows, on="paperclip_id")

# ---------- Supabase -> Paperclip ----------
ULTIMO_INTENTO = {}
def tareas_web_nuevas():
    for t in sb.get("tareas", "paperclip_id=is.null&origen=eq.web&select=*"):
        if time.time() - ULTIMO_INTENTO.get(t["id"], 0) < 120: continue
        ULTIMO_INTENTO[t["id"]] = time.time()
        desc = (t.get("descripcion") or "")
        carpeta = carpeta_producto(t); os.makedirs(carpeta, exist_ok=True)
        for sub in ("fotos", "referencias", "clips", "final"): os.makedirs(os.path.join(carpeta, sub), exist_ok=True)
        # --- audio -> transcripción ---
        if t.get("audio_path") and not t.get("transcripcion"):
            try:
                a = sb_download(t["audio_path"], os.path.join(carpeta, "_encargos", t["id"][:8] + ".webm"))
                txt = transcribir(a) or "(audio vacío)"
                sb.patch("tareas", f"id=eq.{t['id']}", {"transcripcion": txt}); t["transcripcion"] = txt
                print("transcrito", t["id"][:8], len(txt), "chars")
            except Exception as e: print("transcripción fallo:", e); t["transcripcion"] = "(no se pudo transcribir el audio)"
        if t.get("transcripcion"): desc += f"\n\n## Audio de Iván (transcrito)\n{t['transcripcion']}"
        # --- enlace de referencia -> descarga ---
        if t.get("referencia_url"):
            desc += f"\n\n## Vídeo de referencia\nURL: {t['referencia_url']}"
            try:
                refdir = os.path.join(carpeta, "referencias")
                ya = [os.path.join(refdir, f) for f in os.listdir(refdir)] if os.path.isdir(refdir) else []
                f = ya[0] if ya else descargar_referencia(t["referencia_url"], refdir)
                desc += f"\nDescargado en: {f}" if f else "\n(no se pudo descargar; usar la URL)"
            except Exception as e: desc += f"\n(descarga fallida: {e})"
        # --- fotos ---
        fotos = []
        for p in (t.get("fotos_paths") or []):
            try: fotos.append(sb_download(p, os.path.join(carpeta, "fotos", os.path.basename(p))))
            except Exception as e: print("foto fallo:", e)
        if fotos: desc += "\n\n## Fotos del producto\n" + "\n".join(fotos)
        desc += f"\n\nCarpeta del producto: {carpeta}"
        subprocess.run(["chown", "-R", "oficina:oficina", carpeta])
        if t.get("producto_id"):
            p = sb.get("productos", f"id=eq.{t['producto_id']}&select=nombre,slug,tienda,carpeta_drive,brief")
            if p: desc += f"\n\nProducto: {p[0]['nombre']} (slug {p[0]['slug']}, tienda {p[0].get('tienda') or '-'})\nBrief:\n{p[0].get('brief') or '-'}"
        r = cli("agent-prompt", "Jefe", JEFE_KEY, "--title", t["titulo"], desc or t["titulo"], "--json")
        try:
            d = json.loads(r.stdout); i = d.get("issue", d)
            sb.patch("tareas", f"id=eq.{t['id']}", {"paperclip_id": i["id"], "paperclip_identifier": i.get("identifier"), "origen": "paperclip",
                                                      "titulo": f"{i.get('identifier')} · {t['titulo']}"})
            print("tarea web ->", i.get("identifier"))
        except Exception:
            err = (r.stderr or r.stdout)[-300:]
            print("agent-prompt fallo:", err)
            if "paused" in err: sb.insert("mensajes", {"de": "sistema", "para": "ivan", "contenido": f"⚠️ No puedo entregar «{t['titulo']}»: el Jefe está en pausa en Paperclip. Reactívalo (o dime \"activa al Jefe\") y la vuelvo a enviar sola.", "tipo": "sistema", "procesado": True})

def avisos_terminadas(ids):
    for i in q("select id,identifier,title,status,assignee_agent_id from issues where status='done'"):
        t = sb.get("tareas", f"paperclip_id=eq.{i['id']}&select=id,avisado_listo")
        if not t or t[0].get("avisado_listo"): continue
        # buscar entregas en final/
        entregas = []
        for root, _, files in os.walk(os.path.join(OFICINA, "productos")):
            if root.endswith("/final"):
                for f in files:
                    p = os.path.join(root, f)
                    if time.time() - os.path.getmtime(p) < 6 * 3600: entregas.append(p.replace(OFICINA + "/", ""))
        txt = (f"✅ Tarea {i['identifier']} terminada: «{i['title']}».\n"
               + ("Entregas recientes:\n" + "\n".join("• " + e for e in entregas[:8]) + "\n" if entregas else "")
               + f"\nRevísalo y respóndeme aquí con tu feedback empezando por \"{i['identifier']}:\" (qué está bien, qué corregir para la próxima). Lo convertiré en lección para el equipo.")
        tg(txt)
        sb.patch("tareas", f"id=eq.{t[0]['id']}", {"avisado_listo": True})
        print("aviso terminada ->", i["identifier"])

def movimientos_web():
    """Iván arrastra una tarjeta en el tablero -> reasignar en Paperclip."""
    nombre_por_slug = {v: k for k, v in AGENTES.items()}
    ids_by_name = {a["name"]: a["id"] for a in q("select id,name from agents")}
    for t in sb.get("tareas", "mover_a=not.is.null&paperclip_id=not.is.null&select=id,paperclip_id,mover_a,paperclip_identifier"):
        dest = t["mover_a"]
        try:
            if dest == "listo":
                q("update issues set status='done', completed_at=now(), updated_at=now() where id=%s", t["paperclip_id"])
            else:
                aid = ids_by_name.get(nombre_por_slug.get(dest, ""))
                if aid:
                    q("update issues set assignee_agent_id=%s, status='todo', updated_at=now() where id=%s", aid, t["paperclip_id"])
                    q("insert into issue_comments (id,company_id,issue_id,author_user_id,body,created_at,updated_at,author_type) values (gen_random_uuid(),%s,%s,%s,%s,now(),now(),'user')",
                      COMPANY, t["paperclip_id"], ENV.get("PAPERCLIP_USER_ID", "ZDEFzCdEaUcenwUClaDjR8rFxqC4JOSN"), f"Iván ha movido esta tarea en el tablero a {nombre_por_slug.get(dest, dest)}.")
                    cli("agent", "wake", nombre_por_slug.get(dest, dest), "-C", COMPANY)
            print("movida", t.get("paperclip_identifier"), "->", dest)
        except Exception as e:
            print("mover fallo:", e)
        sb.patch("tareas", f"id=eq.{t['id']}", {"mover_a": None})

def cambio_modelo_pendiente():
    """Si hay /root/cambio_modelo_pendiente, aplica ese modelo a todos los agentes en cuanto no haya trabajo en curso."""
    f = "/root/cambio_modelo_pendiente"
    if not os.path.exists(f): return
    modelo = open(f).read().strip()
    en_curso = q("select count(*) c from heartbeat_runs where status in ('running','queued')")[0]["c"]
    abiertas = q("select count(*) c from issues where status='in_progress'")[0]["c"]
    if en_curso or abiertas: return
    q("update agents set adapter_config = adapter_config || %s::jsonb", json.dumps({"model": modelo, "effort": "medium"}))
    os.remove(f)
    tg(f"🔧 Cambio aplicado: los 4 agentes ahora usan {modelo} (esfuerzo medio) y tienen tope de 15 €/mes cada uno.")
    print("modelo cambiado a", modelo)

# ---------- EN VIVO: qué está haciendo cada agente (lee los logs de las vueltas, coste cero) ----------
RUNLOGS = f"/home/oficina/.paperclip/instances/default/data/run-logs/{COMPANY}"
VIVO = {}   # run_id -> {"off": bytes leídos, "buf": texto pendiente, "agente":..., "tarea":...}
VIVO_FIN = set()

def resumen_tool(name, inp):
    inp = inp or {}
    if name == "Bash": return "⌨️ " + (inp.get("description") or inp.get("command", ""))[:140]
    if name in ("Read", "Write", "Edit", "MultiEdit"): return {"Read": "📖 Lee ", "Write": "📝 Escribe ", "Edit": "✏️ Edita ", "MultiEdit": "✏️ Edita "}[name] + os.path.basename(inp.get("file_path", ""))
    if name in ("Glob", "Grep"): return "🔍 Busca " + (inp.get("pattern") or "")[:80]
    if name == "Skill": return "🎓 Usa la skill " + (inp.get("skill") or inp.get("name") or "")
    if name == "WebFetch": return "🌐 Consulta " + (inp.get("url") or "")[:80]
    if name == "WebSearch": return "🌐 Busca en la web: " + (inp.get("query") or "")[:80]
    if name == "Task" or name == "Agent": return "🤖 Delega: " + (inp.get("description") or "")[:100]
    if name.startswith("mcp__"): return "🔌 " + name.replace("mcp__", "").replace("__", " › ")[:80]
    return "🔧 " + name

def en_vivo():
    runs = q("select r.id, r.agent_id, r.status, r.log_ref, i.identifier from heartbeat_runs r left join issues i on i.id=r.issue_id where r.created_at > now() - interval '6 hours' order by r.created_at")
    ids = {a["id"]: AGENTES.get(a["name"]) for a in q("select id,name from agents")}
    filas = []
    for r in runs:
        slug = ids.get(r["agent_id"]);
        if not slug or not r["log_ref"]: continue
        st = VIVO.setdefault(r["id"], {"off": 0, "buf": "", "nuevo": True})
        if st["nuevo"]:
            st["nuevo"] = False
            filas.append({"agente_id": slug, "run_id": r["id"], "tarea": r["identifier"], "tipo": "estado", "texto": f"▶️ Empieza a trabajar en {r['identifier'] or 'la oficina'}"})
        path = os.path.join("/home/oficina/.paperclip/instances/default/data/run-logs", r["log_ref"])
        try:
            with open(path, "rb") as f:
                f.seek(st["off"]); data = f.read(); st["off"] += len(data)
        except FileNotFoundError: data = b""
        for line in data.decode(errors="replace").splitlines():
            try: ev = json.loads(line)
            except Exception: continue
            if ev.get("stream") != "stdout": continue
            st["buf"] += ev.get("chunk", "")
            while "\n" in st["buf"]:
                raw, st["buf"] = st["buf"].split("\n", 1)
                raw = raw.strip()
                if not raw.startswith("{"): continue
                try: m = json.loads(raw)
                except Exception: continue
                if m.get("type") == "assistant":
                    for c in (m.get("message", {}).get("content") or []):
                        if c.get("type") == "text" and c.get("text", "").strip():
                            filas.append({"agente_id": slug, "run_id": r["id"], "tarea": r["identifier"], "tipo": "piensa", "texto": "💭 " + c["text"].strip()[:400]})
                        elif c.get("type") == "tool_use":
                            filas.append({"agente_id": slug, "run_id": r["id"], "tarea": r["identifier"], "tipo": "herramienta", "texto": resumen_tool(c.get("name", ""), c.get("input"))})
                elif m.get("type") == "result":
                    filas.append({"agente_id": slug, "run_id": r["id"], "tarea": r["identifier"], "tipo": "resultado", "texto": "🏁 " + (m.get("result") or "Vuelta terminada").strip()[:400]})
        if r["status"] in ("succeeded", "failed", "cancelled") and r["id"] not in VIVO_FIN:
            VIVO_FIN.add(r["id"])
            txt = {"succeeded": "✅ Vuelta terminada", "failed": "⚠️ Vuelta fallida", "cancelled": "⏹ Vuelta cancelada"}[r["status"]]
            filas.append({"agente_id": slug, "run_id": r["id"], "tarea": r["identifier"], "tipo": "estado", "texto": txt + (f" ({r['identifier']})" if r["identifier"] else "")})
    if filas:
        for i in range(0, len(filas), 50):
            requests.post(f"{SB_URL}/rest/v1/en_vivo", headers=sb.h(), data=json.dumps(filas[i:i+50]), timeout=20)
        # limpiar: dejar las 400 últimas
        try:
            viejas = sb.get("en_vivo", "select=id&order=creado_en.desc&offset=400&limit=200")
            for v in viejas: requests.delete(f"{SB_URL}/rest/v1/en_vivo?id=eq.{v['id']}", headers=sb.h(), timeout=20)
        except Exception: pass

# ---------- APROBACIONES: preguntas/confirmaciones de los agentes -> panel de Iván ----------
AVISADAS = set()
def aprobaciones(ids):
    # 1) Paperclip -> Supabase
    rows = []
    for it in q("select it.id, it.issue_id, it.kind, it.status, it.payload, i.identifier, i.assignee_agent_id from issue_thread_interactions it join issues i on i.id=it.issue_id where it.created_at > now() - interval '7 days'"):
        pl = it["payload"] or {}
        if it["kind"] == "request_confirmation":
            pregunta = pl.get("prompt") or "Confirmación"; opciones = [{"id": "si", "label": "Aprobar"}, {"id": "no", "label": "Rechazar"}]
        elif it["kind"] == "ask_user_questions":
            qs = pl.get("questions") or []
            if not qs: continue
            pregunta = "\n".join(f"• {qq.get('prompt','')}" for qq in qs); opciones = [{"id": o.get("id"), "label": o.get("label")} for o in (qs[0].get("options") or [])]
            if i_es_onboarding(pregunta): continue
        else: continue
        estado = "pendiente" if it["status"] == "pending" else ("aprobada" if it["status"] in ("accepted", "answered", "resolved") else "rechazada")
        rows.append({"id": it["id"], "fuente": "interaccion", "issue_id": it["issue_id"], "tarea": it["identifier"], "agente_id": ids.get(it["assignee_agent_id"]),
                     "pregunta": pregunta[:2000], "opciones": opciones, "estado": estado})
    for ap in q("select a.id, a.type, a.status, a.payload, a.requested_by_agent_id from approvals a where a.created_at > now() - interval '7 days'"):
        pl = ap["payload"] or {}
        pregunta = pl.get("title") or pl.get("summary") or pl.get("description") or f"Aprobación: {ap['type']}"
        estado = "pendiente" if ap["status"] == "pending" else ("aprobada" if ap["status"] == "approved" else "rechazada")
        rows.append({"id": ap["id"], "fuente": "aprobacion", "issue_id": None, "tarea": None, "agente_id": ids.get(ap["requested_by_agent_id"]),
                     "pregunta": str(pregunta)[:2000], "opciones": [{"id": "si", "label": "Aprobar"}, {"id": "no", "label": "Rechazar"}], "estado": estado})
    # no pisar las que Iván ya decidió en la web y aún no se han procesado
    decididas = {a["id"] for a in sb.get("aprobaciones", "procesada=eq.false&decision=not.is.null&select=id")}
    rows = [r for r in rows if r["id"] not in decididas]
    if rows: sb.upsert("aprobaciones", rows, on="id")
    # aviso por Telegram de las nuevas pendientes
    for r in rows:
        if r["estado"] == "pendiente" and r["id"] not in AVISADAS:
            AVISADAS.add(r["id"])
            tg(f"🙋 {r['agente_id'] or 'Un agente'} necesita tu OK ({r['tarea'] or 'oficina'}):\n{r['pregunta'][:600]}\n\nApruébalo en la oficina (panel Pendiente de tu OK) o respóndeme: \"{r['tarea']} aprobado\" / \"{r['tarea']} rechazado: motivo\".")
    # 2) Supabase -> Paperclip (decisiones de Iván)
    for a in sb.get("aprobaciones", "procesada=eq.false&decision=not.is.null&select=*"):
        ok = False
        try:
            if a["fuente"] == "interaccion":
                it = q("select kind from issue_thread_interactions where id=%s", a["id"])
                kind = it[0]["kind"] if it else "request_confirmation"
                if kind == "request_confirmation":
                    if a["decision"] == "si": cmd = ["issue", "interaction:accept", a["issue_id"], a["id"], "-C", COMPANY, "--json"]
                    else: cmd = ["issue", "interaction:reject", a["issue_id"], a["id"], "-C", COMPANY, "--reason", a.get("nota") or "Rechazado por Iván", "--json"]
                else:
                    qid = (q("select payload from issue_thread_interactions where id=%s", a["id"])[0]["payload"].get("questions") or [{}])[0].get("id")
                    cmd = ["issue", "interaction:respond", a["issue_id"], a["id"], "-C", COMPANY, "--answers-json", json.dumps([{"questionId": qid, "selectedOptionIds": [a["decision"]] if a["decision"] not in ("si", "no") else [], "freeText": a.get("nota") or ""}]), "--json"]
                r = cli(*cmd); ok = r.returncode == 0
                if not ok: print("interaccion fallo:", r.stderr[-300:], r.stdout[-200:])
                if a.get("nota"):
                    cli("issue", "comment", a["issue_id"], "-C", COMPANY, "--body", f"Iván: {a['nota']}", "--json")
            else:
                r = cli("approval", "approve" if a["decision"] == "si" else "reject", a["id"], "-C", COMPANY, "--json"); ok = r.returncode == 0
                if not ok: print("approval fallo:", r.stderr[-300:])
        except Exception as e: print("aprobacion fallo:", e)
        sb.patch("aprobaciones", f"id=eq.{a['id']}", {"procesada": True, "estado": ("aprobada" if a["decision"] == "si" else "rechazada") if ok else "pendiente", "decision": a["decision"] if ok else None})
        if ok:
            print("decision aplicada", a["tarea"], a["decision"])
            if a.get("agente_id"): cli("agent", "wake", {"jefe": "Jefe", "tiendas": "Tiendas", "creador": "Creador", "editor": "Editor"}[a["agente_id"]], "-C", COMPANY)

def i_es_onboarding(texto): return "What would you like to do" in texto

def mensajes_web_nuevos():
    for m in sb.get("mensajes", "procesado=eq.false&de=eq.ivan&para=eq.jefe&select=*"):
        args = ["agent-prompt", "Jefe", JEFE_KEY]
        if m.get("tarea_id"):
            t = sb.get("tareas", f"id=eq.{m['tarea_id']}&select=paperclip_id")
            if t and t[0].get("paperclip_id"): args += ["--issue", t[0]["paperclip_id"]]
            else: args += ["--title", m["contenido"][:60]]
        else: args += ["--title", m["contenido"][:60]]
        r = cli(*args, m["contenido"], "--json")
        ok = r.returncode == 0
        sb.patch("mensajes", f"id=eq.{m['id']}", {"procesado": True})
        if ok:
            try:
                i = json.loads(r.stdout).get("issue", {})
                sb.insert("mensajes", {"de": "jefe", "para": "ivan", "contenido": f"Recibido. Lo tienes en {i.get('identifier','la oficina')}: «{i.get('title','')}». Te aviso cuando haya novedades.", "tipo": "sistema", "procesado": True,
                                       "tarea_id": m.get("tarea_id")})
            except Exception: pass
        else: print("mensaje fallo:", r.stderr[-300:])

def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower().encode("ascii", "ignore").decode()).strip("-")
    return s[:60] or "skill"

def escuela():
    """Escuela -> agentes.
    - tipo skill_base  -> archivo real .claude/skills/<slug>/SKILL.md en la carpeta del agente (Claude Code la carga cuando toca)
    - resto (leccion/correccion/ejemplo) -> se añaden al AGENTS.md = ROL.md + lecciones
    """
    import shutil
    ids_by_name = {a["name"]: a["id"] for a in q("select id,name from agents")}
    lecc = sb.get("lecciones", "select=agente_id,titulo,contenido,tipo,activa,orden,creado_en&order=orden,creado_en")
    por = {}
    for l in lecc:
        if l["activa"]: por.setdefault(l["agente_id"], []).append(l)
    for name, slug in AGENTES.items():
        aid = ids_by_name.get(name);
        if not aid: continue
        # --- skills ---
        sdir = os.path.join(ROLES_DIR, slug, ".claude", "skills"); os.makedirs(sdir, exist_ok=True)
        skills = [l for l in por.get(slug, []) if l["tipo"] == "skill_base"]
        deseadas = set()
        for l in skills:
            sk = slugify(l["titulo"]); deseadas.add(sk)
            body = l["contenido"]
            if not body.lstrip().startswith("---"):
                body = f"---\nname: {sk}\ndescription: {l['titulo']}\n---\n\n" + body
            d = os.path.join(sdir, sk)
            if os.path.islink(d): os.unlink(d)
            os.makedirs(d, exist_ok=True)
            p = os.path.join(d, "SKILL.md")
            if not os.path.exists(p) or open(p).read() != body:
                open(p, "w").write(body); print("escuela skill ->", name, sk)
        # skills que ya no están en la Escuela (y que la Escuela gestiona) se retiran
        if skills:
            for e in os.listdir(sdir):
                if e not in deseadas and not e.startswith('higgsfield-'):
                    pth = os.path.join(sdir, e)
                    if os.path.islink(pth): os.unlink(pth)
                    elif os.path.isdir(pth): shutil.rmtree(pth)
                    print("escuela skill retirada ->", name, e)
        subprocess.run(["chown", "-R", "oficina:oficina", os.path.join(ROLES_DIR, slug)])
        # --- lecciones en AGENTS.md ---
        rol = os.path.join(ROLES_DIR, slug, "ROL.md")
        if not os.path.exists(rol): continue
        base = open(rol).read()
        otras = [l for l in por.get(slug, []) if l["tipo"] != "skill_base"]
        extra = ("\n\n# LO QUE IVÁN TE HA ENSEÑADO EN LA ESCUELA (obligatorio)\n" + "\n\n".join(
            f"## [{l['tipo']}] {l['titulo']}\n{l['contenido']}" for l in otras)) if otras else ""
        if skills:
            extra += "\n\n# TUS SKILLS\nTienes estas skills en `.claude/skills/` (cárgalas con la herramienta Skill cuando la tarea lo requiera): " + ", ".join(sorted(deseadas)) + "."
        path = os.path.join(AG_BASE, aid, "instructions", "AGENTS.md")
        nuevo = base + extra
        try:
            if open(path).read() != nuevo:
                open(path, "w").write(nuevo); print("escuela ->", name, len(otras), "lecciones")
        except FileNotFoundError: pass

def loop():
    n = 0
    # al arrancar, no re-publicar vueltas antiguas
    for r in q("select id, log_ref, status from heartbeat_runs where created_at > now() - interval '6 hours'"):
        p = os.path.join("/home/oficina/.paperclip/instances/default/data/run-logs", r["log_ref"] or "")
        VIVO[r["id"]] = {"off": os.path.getsize(p) if os.path.exists(p) else 0, "buf": "", "nuevo": False}
        if r["status"] not in ("running", "queued"): VIVO_FIN.add(r["id"])
    while True:
        try:
            ids = {a["id"]: AGENTES.get(a["name"]) for a in q("select id,name from agents")}
            sync_agentes(ids)
            en_vivo()
            sync_tareas(ids)
            tarea_ids = {t["paperclip_id"]: t["id"] for t in sb.get("tareas", "paperclip_id=not.is.null&select=id,paperclip_id")}
            sync_comentarios(ids, tarea_ids)
            sync_actividad(ids, tarea_ids)
            tareas_web_nuevas()
            movimientos_web()
            aprobaciones(ids)
            mensajes_web_nuevos()
            cambio_modelo_pendiente()
            avisos_terminadas(ids)
            if n % 6 == 0: escuela()
        except Exception:
            traceback.print_exc()
        n += 1; sys.stdout.flush(); time.sleep(5)

if __name__ == "__main__":
    loop()
