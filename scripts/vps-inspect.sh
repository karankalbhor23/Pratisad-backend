#!/usr/bin/env bash
# Run on your Hostinger VPS after SSH login:
#   bash vps-inspect.sh
# Or paste sections manually.

set -euo pipefail

echo "========== SYSTEM =========="
hostname
whoami
uname -a
echo "Uptime: $(uptime -p 2>/dev/null || uptime)"

echo ""
echo "========== DISK / MEMORY =========="
df -h / /var 2>/dev/null || df -h
free -h 2>/dev/null || true

echo ""
echo "========== DOCKER =========="
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || true
  echo "--- Running containers ---"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
  echo "--- All containers ---"
  docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
  echo "--- Networks ---"
  docker network ls
  echo "--- Volumes ---"
  docker volume ls
else
  echo "Docker not installed or not in PATH"
fi

echo ""
echo "========== REVERSE PROXY =========="
for svc in caddy nginx traefik; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "$svc: active"
    systemctl status "$svc" --no-pager -l 2>/dev/null | head -5
  fi
done
if command -v caddy >/dev/null 2>&1; then
  echo "--- Caddy version ---"
  caddy version 2>/dev/null || true
fi

echo ""
echo "========== LISTENING PORTS (80,443,4000,5432,5678,etc) =========="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ':(80|443|4000|5432|5678|8080|3000)\s' || ss -tlnp | head -30
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | head -30
fi

echo ""
echo "========== COMMON DEPLOY PATHS =========="
for d in /opt /srv /var/www /home/*/docker /root/docker ~/docker /etc/caddy /etc/nginx; do
  if [ -d "$d" ]; then
    echo "--- $d ---"
    ls -la "$d" 2>/dev/null | head -20
  fi
done

echo ""
echo "========== DOCKER COMPOSE PROJECTS (find compose files) =========="
find /opt /srv /var/www /root /home -maxdepth 4 -name 'docker-compose*.yml' -o -name 'compose*.yml' 2>/dev/null | head -30

echo ""
echo "========== CADDY / NGINX SITE CONFIGS =========="
[ -d /etc/caddy ] && ls -la /etc/caddy/ 2>/dev/null && head -80 /etc/caddy/Caddyfile 2>/dev/null || true
[ -d /etc/nginx/sites-enabled ] && ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
[ -d /etc/nginx/conf.d ] && ls -la /etc/nginx/conf.d/ 2>/dev/null || true

echo ""
echo "========== FIREWALL =========="
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose 2>/dev/null || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --list-all 2>/dev/null || true
fi

echo ""
echo "========== DONE =========="
