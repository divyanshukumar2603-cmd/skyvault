#!/usr/bin/env bash
# Deploy CloudVault to an EC2 instance (Amazon Linux 2023).
#
#   ./scripts/deploy-ec2.sh <EC2_PUBLIC_IP> [ssh-key-path]
#
# Copies the repo to the instance, rewrites the localhost URLs in .env to the
# instance's public IP, and brings the stack up with docker-compose.prod.yml.

set -euo pipefail

HOST="${1:-}"
KEY="${2:-$HOME/Desktop/allsmall.pem}"
USER="ec2-user"
REMOTE_DIR="/home/${USER}/cloudvault"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$HOST" ]]; then
  echo "usage: $0 <EC2_PUBLIC_IP> [ssh-key-path]" >&2
  exit 1
fi

SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "${USER}@${HOST}")

echo "==> 1/6 Checking SSH reachability"
if ! "${SSH[@]}" 'echo ok' >/dev/null 2>&1; then
  echo "ERROR: cannot SSH to ${HOST}." >&2
  echo "  - Is the instance running? (AWS Academy labs stop it when the session ends)" >&2
  echo "  - Did the public IP change after a restart?" >&2
  echo "  - Does the security group allow port 22 from your IP ($(curl -s https://checkip.amazonaws.com || echo '?'))?" >&2
  exit 1
fi

echo "==> 2/6 Quiescing any old containers before they exhaust the box"
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -e
if command -v docker >/dev/null && sudo systemctl is-active --quiet docker; then
  RUNNING=$(sudo docker ps -q | wc -l | tr -d ' ')
  if [ "$RUNNING" != "0" ]; then
    echo "  stopping ${RUNNING} running container(s)"
    sudo docker stop $(sudo docker ps -q) >/dev/null 2>&1 || true
  else
    echo "  no containers running"
  fi
  # restart:always containers otherwise come straight back after a reboot
  sudo docker update --restart=no $(sudo docker ps -aq) >/dev/null 2>&1 || true
  # containers from an earlier deploy hold the cloudvault-* names; remove them
  # (named volumes are left intact, so database contents survive)
  STALE=$(sudo docker ps -aq --filter 'name=cloudvault-')
  if [ -n "$STALE" ]; then
    echo "  removing stale cloudvault containers"
    sudo docker rm -f $STALE >/dev/null 2>&1 || true
  fi
else
  echo "  docker not running yet"
fi
REMOTE

echo "==> 2a/6 Ensuring swap (prevents OOM on small instances)"
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -e
if ! sudo swapon --show | grep -q swapfile; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "  swap enabled (2G)"
else
  echo "  swap already present"
fi
REMOTE

echo "==> 2b/6 Checking disk space"
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -e
USE=$(df --output=pcent / | tail -1 | tr -dc '0-9')
echo "  root filesystem ${USE}% used"
if [ "$USE" -ge 80 ]; then
  echo "  reclaiming space (docker prune)"
  sudo docker system prune -af --volumes >/dev/null 2>&1 || true
  sudo journalctl --vacuum-size=100M >/dev/null 2>&1 || true
  df -h / | tail -1
fi
REMOTE

echo "==> 3/6 Ensuring Docker + compose plugin"
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -e
if ! command -v docker >/dev/null; then
  sudo dnf install -y docker >/dev/null
  sudo usermod -aG docker ec2-user
fi
sudo systemctl enable --now docker >/dev/null
sudo mkdir -p /usr/libexec/docker/cli-plugins
if ! docker compose version >/dev/null 2>&1; then
  sudo curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o /usr/libexec/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
fi
# recent compose delegates builds to buildx, which Amazon Linux does not ship
# recent compose delegates builds to buildx and needs >= 0.17; AL2023 ships 0.12
# The build runs as root, so buildx must be in the SYSTEM plugin dir, not ~/.docker.
BX=$(sudo docker buildx version 2>/dev/null | awk '{print $2}' | tr -d 'v' || echo 0)
if [ "$(printf '%s\n0.17.0\n' "${BX:-0}" | sort -V | head -1)" != "0.17.0" ]; then
  echo "  upgrading buildx for root (found ${BX:-none})"
  ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64 ;; aarch64) ARCH=arm64 ;; esac
  TAG=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep -m1 '"tag_name"' | cut -d'"' -f4)
  sudo curl -sSL "https://github.com/docker/buildx/releases/download/${TAG}/buildx-${TAG}.linux-${ARCH}" \
    -o /usr/libexec/docker/cli-plugins/docker-buildx
  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
fi
sudo docker --version && sudo docker compose version && sudo docker buildx version
REMOTE

echo "==> 4/6 Syncing project files"
"${SSH[@]}" "mkdir -p ${REMOTE_DIR}"
rsync -az --delete \
  -e "ssh -i ${KEY} -o StrictHostKeyChecking=accept-new" \
  --exclude '.git' --exclude 'node_modules' --exclude '.next' \
  --exclude 'dist' --exclude '*.pem' --exclude 'docs/images' \
  "${PROJECT_ROOT}/" "${USER}@${HOST}:${REMOTE_DIR}/"

echo "==> 5/6 Rewriting .env URLs for ${HOST}"
"${SSH[@]}" "bash -s" <<REMOTE
set -e
cd ${REMOTE_DIR}
sed -i \
  -e "s|^FRONTEND_URL=.*|FRONTEND_URL=http://${HOST}:3000|" \
  -e "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${HOST}:4000|" \
  -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://${HOST}:3000|" \
  -e "s|^OAUTH_CALLBACK_URL=.*|OAUTH_CALLBACK_URL=http://${HOST}:4000/api/auth|" \
  .env
grep -E '^(FRONTEND_URL|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_APP_URL|OAUTH_CALLBACK_URL)=' .env
REMOTE

echo "==> 6/6 Building and starting containers"
"${SSH[@]}" "cd ${REMOTE_DIR} && sudo docker compose -f docker-compose.prod.yml up -d --build"
"${SSH[@]}" "cd ${REMOTE_DIR} && sudo docker compose -f docker-compose.prod.yml ps"

echo "==> Seeding product catalogue (idempotent)"
"${SSH[@]}" "cd ${REMOTE_DIR} && sudo docker compose -f docker-compose.prod.yml exec -T backend npm run seed:products" 2>&1 | tail -8

cat <<EOF

Deployed.
  Frontend : http://${HOST}:3000
  Backend  : http://${HOST}:4000/health

Security group must allow inbound 3000 and 4000 from your IP.
S3 CORS must list http://${HOST}:3000 as an allowed origin.
EOF
