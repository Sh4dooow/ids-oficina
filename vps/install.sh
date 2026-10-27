#!/usr/bin/env bash
# ============================================================
#  Iván Digital Studio · Oficina — instalación del servidor
#  Ubuntu 24.04/26.04 · ejecutar como root
#
#  Antes de ejecutar, crea /root/oficina.env con:
#    ANTHROPIC_API_KEY=sk-ant-...
#    TELEGRAM_BOT_TOKEN=123456:ABC...
#    TELEGRAM_CHAT_ID=123456789
#    PUBLIC_HOST=oficina-49-12-251-2.sslip.io   (o tu dominio)
#
#  Uso:  bash install.sh            (todo)
#        bash install.sh base       (solo sistema)
#        bash install.sh paperclip  (solo Paperclip)
#        bash install.sh openclaw   (solo OpenClaw/Jefe)
#        bash install.sh caddy      (solo HTTPS)
# ============================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

USUARIO=oficina
HOME_OF=/home/$USUARIO
ENV_FILE=/root/oficina.env
[ -f "$ENV_FILE" ] || { echo "Falta $ENV_FILE"; exit 1; }
set -a; source "$ENV_FILE"; set +a
: "${ANTHROPIC_API_KEY:?}" "${TELEGRAM_BOT_TOKEN:?}" "${TELEGRAM_CHAT_ID:?}" "${PUBLIC_HOST:?}"

log() { echo -e "\n\033[1;33m==> $*\033[0m"; }
como_oficina() { sudo -u $USUARIO -H env "PATH=$HOME_OF/.local/bin:$HOME_OF/.npm-global/bin:/usr/local/bin:/usr/bin:/bin" ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" bash -lc "$*"; }

# ------------------------------------------------------------
base() {
  log "Paquetes del sistema"
  apt-get update -q
  apt-get install -y -q curl git ffmpeg python3 python3-pip build-essential ufw unzip jq ca-certificates gnupg

  log "Node 24 (NodeSource)"
  if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 24 ]; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y -q nodejs
  fi
  node -v; npm -v
  corepack enable || true
  corepack prepare pnpm@latest --activate || npm i -g pnpm

  log "Usuario $USUARIO"
  id $USUARIO >/dev/null 2>&1 || adduser --disabled-password --gecos "" $USUARIO
  loginctl enable-linger $USUARIO
  mkdir -p $HOME_OF/.npm-global $HOME_OF/.local/bin
  como_oficina "npm config set prefix '$HOME_OF/.npm-global'"
  grep -q npm-global $HOME_OF/.bashrc || echo 'export PATH=$HOME/.npm-global/bin:$HOME/.local/bin:$PATH' >> $HOME_OF/.bashrc

  log "Claude Code (runtime de los agentes)"
  como_oficina "npm i -g @anthropic-ai/claude-code && claude --version"

  log "Estructura de la oficina"
  mkdir -p $HOME_OF/oficina/{agentes/{tiendas,creador,editor},OFICINA/{_contexto,productos/_PLANTILLA/{fotos,referencias,clips,final}},skills}
  chown -R $USUARIO:$USUARIO $HOME_OF

  log "Firewall"
  ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp
  ufw --force enable
}

# ------------------------------------------------------------
paperclip() {
  log "Paperclip (la empresa)"
  como_oficina "cd ~ && npx -y paperclipai@latest onboard --yes --no-start-now 2>&1 | tail -20 || true"
  # Modo autenticado + público, detrás de Caddy (HTTPS)
  mkdir -p $HOME_OF/.paperclip
  cat > $HOME_OF/.paperclip/oficina.env <<EOF
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
PAPERCLIP_PUBLIC_URL=https://$PUBLIC_HOST
PAPERCLIP_AUTH_PUBLIC_BASE_URL=https://$PUBLIC_HOST
HOST=127.0.0.1
PORT=3100
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
PAPERCLIP_TELEMETRY_DISABLED=1
EOF
  chown -R $USUARIO:$USUARIO $HOME_OF/.paperclip
  chmod 600 $HOME_OF/.paperclip/oficina.env
  como_oficina "npx -y paperclipai@latest service install --enable-linger --no-start-now || true"
  # Inyecta el env en el servicio de usuario
  UNIT=$HOME_OF/.config/systemd/user/paperclipai.service
  if [ -f "$UNIT" ] && ! grep -q oficina.env "$UNIT"; then
    sed -i "/^\[Service\]/a EnvironmentFile=$HOME_OF/.paperclip/oficina.env" "$UNIT"
  fi
  como_oficina "systemctl --user daemon-reload && systemctl --user enable --now paperclipai && sleep 5 && systemctl --user status paperclipai --no-pager | head -5"
}

# ------------------------------------------------------------
openclaw() {
  log "OpenClaw (el Jefe, con Telegram)"
  como_oficina "curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard" || como_oficina "npm i -g openclaw"
  como_oficina "openclaw onboard --non-interactive --accept-risk --mode local --auth-choice apiKey \
     --anthropic-api-key '$ANTHROPIC_API_KEY' --secret-input-mode plaintext \
     --gateway-bind loopback --install-daemon --daemon-runtime node --skip-bootstrap --skip-skills"
  como_oficina "openclaw channels add --channel telegram --token '$TELEGRAM_BOT_TOKEN'"
  # Solo Iván puede hablar con el Jefe
  como_oficina "openclaw config set channels.telegram.dmPolicy allowlist && openclaw config set channels.telegram.allowFrom '[\"$TELEGRAM_CHAT_ID\"]'" || true
  como_oficina "openclaw gateway restart || openclaw gateway start"
  como_oficina "openclaw channels status --probe || true"
}

# ------------------------------------------------------------
caddy() {
  log "Caddy (HTTPS para el panel de Paperclip)"
  if ! command -v caddy >/dev/null; then
    apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -q && apt-get install -y -q caddy
  fi
  cat > /etc/caddy/Caddyfile <<EOF
$PUBLIC_HOST {
    reverse_proxy 127.0.0.1:3100
    encode gzip
}
EOF
  systemctl enable --now caddy
  systemctl reload caddy
  echo "Panel: https://$PUBLIC_HOST"
}

# ------------------------------------------------------------
case "${1:-all}" in
  base) base ;;
  paperclip) paperclip ;;
  openclaw) openclaw ;;
  caddy) caddy ;;
  all) base; paperclip; openclaw; caddy ;;
  *) echo "uso: $0 [base|paperclip|openclaw|caddy|all]"; exit 1 ;;
esac
log "Listo."
