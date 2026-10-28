#!/bin/bash
# Puente stdio -> MCP HTTP del SRZ Editor (PC de Ivan, vía Tailscale). El token lo lee de Drive al arrancar.
T=$("$(dirname "$0")/srz_token.sh")
export PATH=/home/oficina/.npm-global/bin:$PATH
exec mcp-remote http://127.0.0.1:8788/mcp --transport http-only --header "Authorization: Bearer $T" --allow-http
