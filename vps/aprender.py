#!/usr/bin/env python3
"""
Convierte el feedback de Iván en una lección de la Escuela (Supabase -> agentes).
Uso: aprender.py <agentes> "<título>" "<lección>"
  <agentes>: jefe | tiendas | creador | editor | todos | creador,editor
Tipo de lección: correccion (es lo que dice Iván tras revisar una entrega).
"""
import sys, os, json, requests
ENV = {}
for line in open("/root/oficina.env"):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1); ENV[k] = v
SB_URL, SB_KEY = ENV["SUPABASE_URL"], ENV["SUPABASE_ANON_KEY"]

def login():
    r = requests.post(f"{SB_URL}/auth/v1/token?grant_type=password", headers={"apikey": SB_KEY, "Content-Type": "application/json"},
                      json={"email": ENV["SUPABASE_SYNC_EMAIL"], "password": ENV["SUPABASE_SYNC_PASSWORD"]}, timeout=20)
    r.raise_for_status(); return r.json()["access_token"]

def main():
    if len(sys.argv) < 4: print(__doc__); sys.exit(1)
    agentes, titulo, contenido = sys.argv[1], sys.argv[2], sys.argv[3]
    lista = ["jefe", "tiendas", "creador", "editor"] if agentes == "todos" else [a.strip() for a in agentes.split(",")]
    tok = login(); h = {"apikey": SB_KEY, "Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Prefer": "return=representation"}
    rows = [{"agente_id": a, "titulo": titulo[:120], "contenido": contenido, "tipo": "correccion", "orden": 999} for a in lista]
    r = requests.post(f"{SB_URL}/rest/v1/lecciones", headers=h, data=json.dumps(rows), timeout=20)
    if r.status_code >= 300: print("ERROR", r.status_code, r.text[:200]); sys.exit(1)
    print(f"OK lección «{titulo}» guardada para: {', '.join(lista)} (se aplica en <1 min)")

if __name__ == "__main__": main()
