#!/usr/bin/env python3
"""
Sistema de multiplicación del Editor de la Oficina.
Genera N variantes combinando gancho × cuerpo(s) × showcase, con texto y canción
(con el drop sincronizado en la sección elegida). Original, basado en engine.py.

Entrada (JSON):
{
  "w":1080,"h":1920,"fps":30,
  "hooks":    ["gancho1.mp4", ...],          # opcional
  "bodies":   ["cuerpo1.mp4", ...],          # obligatorio (al menos 1)
  "showcases":["showcase1.mp4", ...],        # opcional
  "bodies_per_video": 1,                       # cuántos cuerpos por vídeo (1 por defecto)
  "texts":    ["TEXTO 1", "TEXTO 2", ...],   # se reparten entre las variantes
  "songs":    [ {"src":"cancion.mp3","drop":12.5}, ... ],
  "drop_target": "showcase",                  # showcase | body | hook | none
  "n": 10,                                     # cuántos vídeos (máx 64)
  "salida_dir": "/ruta/variantes"
}
Uso: batch.py tanda.json
"""
import json, os, sys, random, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import render

def combos(hooks, bodies, showcases, bpv):
    H = hooks or [None]
    S = showcases or [None]
    B = list(itertools.permutations(bodies, bpv)) if bpv > 1 else [(b,) for b in bodies]
    out = []
    for h in H:
        for bset in B:
            for s in S:
                out.append((h, bset, s))
    return out

def max_variantes(hooks, bodies, showcases, bpv):
    import math
    nb = math.perm(len(bodies), bpv) if bpv > 1 else len(bodies)
    return max(1, (len(hooks) or 1)) * nb * max(1, (len(showcases) or 1))

def generar(cfg):
    hooks = cfg.get("hooks") or []
    bodies = cfg.get("bodies") or []
    shows = cfg.get("showcases") or []
    bpv = int(cfg.get("bodies_per_video", 1))
    if not bodies: raise ValueError("Hacen falta clips de cuerpo (bodies).")
    texts = cfg.get("texts") or []
    songs = cfg.get("songs") or []
    target = cfg.get("drop_target", "showcase")
    n = min(int(cfg.get("n", 10)), 64)
    out_dir = cfg["salida_dir"]; os.makedirs(out_dir, exist_ok=True)

    todos = combos(hooks, bodies, shows, bpv)
    random.shuffle(todos)
    todos = todos[:n]
    resultados = []
    for i, (h, bset, s) in enumerate(todos, 1):
        clips, idx = [], {}
        if h: idx["hook"] = len(clips); clips.append({"src": h, "mute": True})
        idx["body"] = len(clips)
        for b in bset: clips.append({"src": b, "mute": True})
        if s: idx["showcase"] = len(clips); clips.append({"src": s, "mute": True})
        proj = {"w": cfg.get("w", 1080), "h": cfg.get("h", 1920), "fps": cfg.get("fps", 30),
                "clips": clips}
        if texts:
            proj["texts"] = [{"text": texts[(i - 1) % len(texts)], "x": 0.5, "y": 0.12,
                              "size": 64, "start": 0, "end": 9999}]
        if songs:
            song = dict(songs[(i - 1) % len(songs)])
            sync_i = idx.get(target)
            if sync_i is not None: song["sync_to_clip"] = sync_i
            song.setdefault("volume", 0.9)
            proj["songs"] = [song]
        salida = os.path.join(out_dir, f"variante_{i:03d}.mp4")
        try:
            info = render(proj, salida)
            resultados.append({"n": i, "salida": salida, "dur": info["dur"],
                               "texto": texts[(i-1) % len(texts)] if texts else None})
        except Exception as e:
            resultados.append({"n": i, "error": str(e)[:200]})
    return resultados

if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1]))
    res = generar(cfg)
    ok = [r for r in res if "salida" in r]
    print(json.dumps({"generados": len(ok), "total": len(res),
                      "max_posibles": max_variantes(cfg.get("hooks") or [], cfg["bodies"],
                                                     cfg.get("showcases") or [],
                                                     int(cfg.get("bodies_per_video", 1))),
                      "variantes": res}, ensure_ascii=False, indent=2))
