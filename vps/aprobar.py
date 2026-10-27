#!/usr/bin/env python3
"""Aprobar/rechazar desde Telegram: aprobar.py <IVA-n> <si|no> ["nota"] -> deja la decisión en Supabase; el puente la aplica."""
import sys, os, json, requests
ENV = {}
for line in open(os.path.expanduser("~/.oficina.env") if os.path.exists(os.path.expanduser("~/.oficina.env")) else "/root/oficina.env"):
    if "=" in line and not line.startswith("#"): k, v = line.rstrip("\n").split("=", 1); ENV[k] = v
SB, KEY = ENV["SUPABASE_URL"], ENV["SUPABASE_ANON_KEY"]
tok = requests.post(f"{SB}/auth/v1/token?grant_type=password", headers={"apikey": KEY, "Content-Type": "application/json"},
                    json={"email": ENV["SUPABASE_SYNC_EMAIL"], "password": ENV["SUPABASE_SYNC_PASSWORD"]}, timeout=20).json()["access_token"]
h = {"apikey": KEY, "Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Prefer": "return=representation"}
tarea, dec = sys.argv[1].upper(), ("si" if sys.argv[2].lower() in ("si", "sí", "ok", "aprobado", "yes") else "no")
nota = sys.argv[3] if len(sys.argv) > 3 else ""
pend = requests.get(f"{SB}/rest/v1/aprobaciones?tarea=eq.{tarea}&estado=eq.pendiente&select=id,pregunta&order=creado_en.desc", headers=h, timeout=20).json()
if not pend: print(f"No hay nada pendiente de aprobar en {tarea}."); sys.exit(0)
for p in pend[:1]:
    requests.patch(f"{SB}/rest/v1/aprobaciones?id=eq.{p['id']}", headers=h, data=json.dumps({"decision": dec, "nota": nota}), timeout=20)
    print(f"OK {tarea}: {'APROBADO' if dec=='si' else 'RECHAZADO'} → «{p['pregunta'][:120]}». Se aplica en segundos.")
