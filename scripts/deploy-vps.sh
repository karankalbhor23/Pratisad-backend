#!/usr/bin/env bash
# Pull latest code and rebuild Pratisad API on the VPS (same flow as LMS).
#
# Usage (on VPS, from repo root):
#   ./scripts/deploy-vps.sh          # pull main + rebuild
#   ./scripts/deploy-vps.sh --no-pull  # rebuild only
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.vps.yml"
BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.vps.example to .env and fill in values."
  exit 1
fi

if [[ "${1:-}" != "--no-pull" ]]; then
  echo "==> git pull origin ${BRANCH}"
  git pull origin "${BRANCH}"
fi

echo "==> docker compose -f ${COMPOSE_FILE} up -d --build"
docker compose -f "${COMPOSE_FILE}" up -d --build

echo "==> Recent logs"
docker compose -f "${COMPOSE_FILE}" logs --tail=40 pratisad-api

echo ""
echo "Deploy complete."
echo "Health: curl -s http://127.0.0.1:4002/health"
echo "Public: curl -s https://api.pratisad.scaleopal.com/health"
