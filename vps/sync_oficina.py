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
def tareas_web_nuevas():
    for t in sb.get("tareas", "paperclip_id=is.null&origen=eq.web&select=*"):
        desc = (t.get("descripcion") or "")
        if t.get("producto_id"):
            p = sb.get("productos", f"id=eq.{t['producto_id']}&select=nombre,slug,tienda,carpeta_drive,brief")
            if p: desc += f"\n\nProducto: {p[0]['nombre']} (slug {p[0]['slug']}, tienda {p[0].get('tienda') or '-'})\nBrief:\n{p[0].get('brief') or '-'}"
        r = cli("agent-prompt", "Jefe", JEFE_KEY, "--title", t["titulo"], desc or t["titulo"], "--json")
        try:
            d = json.loads(r.stdout); i = d.get("issue", d)
            sb.patch("tareas", f"id=eq.{t['id']}", {"paperclip_id": i["id"], "paperclip_identifier": i.get("identifier"), "origen": "paperclip",
                                                      "titulo": f"{i.get('identifier')} · {t['titulo']}"})
            print("tarea web ->", i.get("identifier"))
        except Exception: print("agent-prompt fallo:", r.stdout[-300:], r.stderr[-300:])

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
                if e not in deseadas:
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
    while True:
        try:
            ids = {a["id"]: AGENTES.get(a["name"]) for a in q("select id,name from agents")}
            sync_agentes(ids)
            sync_tareas(ids)
            tarea_ids = {t["paperclip_id"]: t["id"] for t in sb.get("tareas", "paperclip_id=not.is.null&select=id,paperclip_id")}
            sync_comentarios(ids, tarea_ids)
            sync_actividad(ids, tarea_ids)
            tareas_web_nuevas()
            mensajes_web_nuevos()
            if n % 6 == 0: escuela()
        except Exception:
            traceback.print_exc()
        n += 1; sys.stdout.flush(); time.sleep(5)

if __name__ == "__main__":
    loop()
