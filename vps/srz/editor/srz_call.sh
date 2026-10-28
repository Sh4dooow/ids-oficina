#!/bin/bash
# srz_call.sh <herramienta> '<json de argumentos>'  → llama al MCP de SRZ Editor (en el PC de Ivan, vía túnel) en un solo paso.
T=$("$(dirname "$0")/srz_token.sh")
U=http://127.0.0.1:8788/mcp
H=(-s -m 600 -H "Authorization: Bearer $T" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")
SID=$(curl "${H[@]}" -D - -o /dev/null -X POST $U -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"oficina-editor","version":"1"}}}' | grep -i '^mcp-session-id:' | tr -d '\r' | cut -d' ' -f2)
[ -n "$SID" ] || { echo "ERROR: SRZ Editor no responde (¿PC de Iván apagado o SRZ cerrado?)"; exit 1; }
curl "${H[@]}" -H "mcp-session-id: $SID" -X POST $U -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
ARGS=${2:-{\}}
python3 -c 'import json,sys; json.loads(sys.argv[1])' "$ARGS" || { echo "ERROR: argumentos no son JSON"; exit 1; }
curl "${H[@]}" -H "mcp-session-id: $SID" -X POST $U -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$ARGS}}" | sed -n 's/^data: //p' | python3 -c '
import sys,json
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    r=json.loads(line)
    if "error" in r: print("ERROR:", r["error"].get("message")); continue
    res=r.get("result",{})
    for c in res.get("content",[]):
        if c.get("type")=="text": print(c["text"])
        elif c.get("type")=="image":
            import base64,os,time; p=f"/tmp/srz_preview_{int(time.time())}.jpg"; open(p,"wb").write(base64.b64decode(c["data"])); print("[imagen guardada en", p+"]")
        else: print(json.dumps(c,ensure_ascii=False)[:500])
    if res.get("isError"): print("(isError)")
'
