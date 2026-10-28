#!/usr/bin/env python3
"""
Editor de la Oficina — motor de montaje de vídeo (original, basado en ffmpeg).
Toma un proyecto (JSON) y renderiza un mp4 vertical 9:16 listo para subir.

Modelo de proyecto:
{
  "name": "...", "w": 1080, "h": 1920, "fps": 30,
  "clips":  [ {"src": "...", "in": 0.0, "out": 3.0, "speed": 1.0, "volume": 1.0,
               "mute": false, "zoom": 1.0} ],     # pista de vídeo, en orden
  "songs":  [ {"src": "...", "drop": 0.0, "volume": 0.9} ],  # música; empieza en el drop
  "captions":[ {"text": "...", "start": 0.0, "end": 2.0, "pos": "bottom"} ],
  "texts":  [ {"text": "...", "start": 0.0, "end": 2.0, "x": 0.5, "y": 0.5,
               "size": 72, "color": "white"} ]
}
Uso: engine.py proyecto.json salida.mp4
"""
import json, os, sys, subprocess, tempfile, shutil

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg falló:\n" + " ".join(cmd[:6]) + "…\n" + r.stderr[-1500:])
    return r

def probe_dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nk=1:nw=1", path], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0.0

def esc(t):
    # escapar texto para drawtext
    return (t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’")
             .replace("%", "\\%").replace(",", "\\,"))

FONT = next((f for f in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"] if os.path.exists(f)), None)

def normaliza_clip(src, out_path, W, H, fps, tin, tout, speed, zoom, mute):
    """Recorta, ajusta velocidad, escala/recorta a WxH (cover) y normaliza a fps y SAR."""
    dur = max(0.05, (tout - tin))
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H},setsar=1,fps={fps}")
    if zoom and abs(zoom - 1.0) > 0.001:
        zw = int(W * zoom); zh = int(H * zoom)
        vf = (f"scale={zw}:{zh}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H}:(iw-{W})/2:(ih-{H})/2,setsar=1,fps={fps}")
    if speed and abs(speed - 1.0) > 0.001:
        vf += f",setpts=PTS/{speed}"
    # Siempre dejamos una pista de audio (silencio si va en mute) para que el concat sea uniforme
    cmd = ["ffmpeg", "-y", "-ss", f"{tin}", "-t", f"{dur}", "-i", src]
    if mute:
        cmd += ["-f", "lavfi", "-t", f"{dur/max(0.5,min(2.0,speed)) if speed else dur}",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-vf", vf, "-map", "0:v:0", "-map", "1:a:0", "-shortest"]
    else:
        af = f"atempo={max(0.5,min(2.0,speed))}" if speed and abs(speed-1)>0.001 else "anull"
        cmd += ["-vf", vf, "-af", af, "-map", "0:v:0", "-map", "0:a:0?"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ar", "48000", "-ac", "2", out_path]
    run(cmd)

def render(proj, salida):
    W = int(proj.get("w", 1080)); H = int(proj.get("h", 1920)); fps = int(proj.get("fps", 30))
    clips = proj.get("clips", [])
    if not clips: raise ValueError("El proyecto no tiene clips.")
    tmp = tempfile.mkdtemp(prefix="edit_")
    try:
        # 1) normalizar cada clip a piezas uniformes
        piezas = []
        for i, c in enumerate(clips):
            src = c["src"]
            if not os.path.isfile(src): raise FileNotFoundError(src)
            tin = float(c.get("in", 0))
            tout = float(c.get("out", tin + probe_dur(src)))
            p = os.path.join(tmp, f"c{i:03d}.mp4")
            normaliza_clip(src, p, W, H, fps, tin, tout,
                           float(c.get("speed", 1.0)), float(c.get("zoom", 1.0)),
                           bool(c.get("mute", False)) or float(c.get("volume", 1.0)) == 0)
            piezas.append(p)
        # 2) concatenar
        lista = os.path.join(tmp, "lista.txt")
        with open(lista, "w") as f:
            for p in piezas: f.write(f"file '{p}'\n")
        base = os.path.join(tmp, "base.mp4")
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lista,
             "-c", "copy", base])
        total = probe_dur(base)
        # inicios de cada clip en la línea de tiempo (para sincronizar el drop con el clip de showcase)
        starts, acc = [], 0.0
        for p in piezas:
            starts.append(acc); acc += probe_dur(p)
        # 3) música: el DROP de la canción cae justo al empezar el clip indicado (sync_to_clip).
        song = (proj.get("songs") or [None])[0]
        inputs = ["-i", base]; fc = []; amap = "0:a"
        if song and os.path.isfile(song.get("src", "")):
            drop = float(song.get("drop", 0))
            sync = song.get("sync_to_clip")
            t_target = starts[sync] if (sync is not None and 0 <= sync < len(starts)) else 0.0
            vol = float(song.get("volume", 0.9))
            ss = drop - t_target   # dónde empieza a sonar la canción para que el drop caiga en t_target
            if ss >= 0:
                inputs += ["-ss", f"{ss}", "-i", song["src"]]
                fc.append(f"[1:a]volume={vol},atrim=0:{total},asetpts=N/SR/TB[mus]")
            else:
                # el drop va más tarde que el inicio de la canción: metemos silencio delante
                inputs += ["-i", song["src"]]
                fc.append(f"[1:a]volume={vol},adelay={int(-ss*1000)}|{int(-ss*1000)},"
                          f"atrim=0:{total},asetpts=N/SR/TB[mus]")
            fc.append(f"[0:a]volume=1.0[clipa]")
            fc.append(f"[clipa][mus]amix=inputs=2:duration=first:dropout_transition=0[aout]")
            amap = "[aout]"
        # 4) textos y subtítulos quemados
        draw = []
        for t in proj.get("texts", []):
            if not FONT: break
            x = f"(w-text_w)*{float(t.get('x',0.5))}"; y = f"(h-text_h)*{float(t.get('y',0.5))}"
            draw.append(f"drawtext=fontfile='{FONT}':text='{esc(t['text'])}':"
                        f"fontsize={int(t.get('size',72))}:fontcolor={t.get('color','white')}:"
                        f"borderw=4:bordercolor=black@0.9:x={x}:y={y}:"
                        f"enable='between(t,{float(t.get('start',0))},{float(t.get('end',total))})'")
        for c in proj.get("captions", []):
            if not FONT: break
            pos = c.get("pos", "bottom")
            y = "h*0.80" if pos == "bottom" else ("h*0.10" if pos == "top" else "(h-text_h)/2")
            draw.append(f"drawtext=fontfile='{FONT}':text='{esc(c['text'])}':"
                        f"fontsize={int(c.get('size',58))}:fontcolor=white:borderw=5:bordercolor=black:"
                        f"x=(w-text_w)/2:y={y}:box=1:boxcolor=black@0.35:boxborderw=18:"
                        f"enable='between(t,{float(c.get('start',0))},{float(c.get('end',total))})'")
        vmap = "0:v"
        if draw:
            fc.append(f"[0:v]{','.join(draw)}[vout]"); vmap = "[vout]"
        cmd = ["ffmpeg", "-y"] + inputs
        if fc: cmd += ["-filter_complex", ";".join(fc)]
        cmd += ["-map", vmap, "-map", amap,
                "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                "-r", str(fps), salida]
        run(cmd)
        return {"salida": salida, "dur": round(probe_dur(salida), 2), "w": W, "h": H, "clips": len(clips)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("uso: engine.py proyecto.json salida.mp4"); sys.exit(1)
    proj = json.load(open(sys.argv[1]))
    print(json.dumps(render(proj, sys.argv[2]), ensure_ascii=False))
