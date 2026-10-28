#!/bin/sh
# Instala Tailscale en el servidor de la Oficina y lo conecta a la cuenta de Ivan.
# Al final imprime un enlace login.tailscale.com/a/... que Ivan abre en su PC para aprobar.
set -e
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled
echo "=== ABRE EN TU PC EL ENLACE QUE SALE ABAJO ==="
tailscale up --hostname oficina --accept-dns=false
echo "=== LISTO. IP del servidor en Tailscale: $(tailscale ip -4) ==="
