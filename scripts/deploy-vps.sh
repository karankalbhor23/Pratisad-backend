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
HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_INTERVAL_SECONDS="${DEPLOY_HEALTH_INTERVAL_SECONDS:-5}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:4002/health}"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.vps.example to .env and fill in values."
  exit 1
fi

if [[ ! "${HEALTH_TIMEOUT_SECONDS}" =~ ^[1-9][0-9]*$ || ! "${HEALTH_INTERVAL_SECONDS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "DEPLOY_HEALTH_TIMEOUT_SECONDS and DEPLOY_HEALTH_INTERVAL_SECONDS must be positive integers." >&2
  exit 1
fi

if [[ "${1:-}" != "--no-pull" ]]; then
  echo "==> git pull origin ${BRANCH}"
  git pull origin "${BRANCH}"
fi

echo "==> Validating Docker Compose configuration"
docker compose -f "${COMPOSE_FILE}" config --quiet

echo "==> docker compose -f ${COMPOSE_FILE} up -d --build"
docker compose -f "${COMPOSE_FILE}" up -d --build

echo "==> Waiting for API health (${HEALTH_TIMEOUT_SECONDS}s timeout)"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  container_status="$(docker inspect -f '{{.State.Status}}' pratisad-api 2>/dev/null || true)"
  health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' pratisad-api 2>/dev/null || true)"

  if [[ "${container_status}" == "running" && "${health_status}" == "healthy" ]]; then
    if curl --fail --silent --show-error --max-time 10 "${HEALTH_URL}" >/dev/null; then
      echo "API is healthy: ${HEALTH_URL}"
      break
    fi
  elif [[ "${container_status}" == "exited" || "${container_status}" == "dead" || "${container_status}" == "restarting" ]]; then
    echo "API container entered an unhealthy lifecycle state: ${container_status} (${health_status})" >&2
    docker compose -f "${COMPOSE_FILE}" logs --tail=80 pratisad-api >&2 || true
    exit 1
  fi

  sleep "${HEALTH_INTERVAL_SECONDS}"
done

if (( SECONDS >= deadline )); then
  echo "API did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s" >&2
  docker compose -f "${COMPOSE_FILE}" ps >&2 || true
  docker compose -f "${COMPOSE_FILE}" logs --tail=80 pratisad-api >&2 || true
  exit 1
fi

echo "==> Recent logs"
docker compose -f "${COMPOSE_FILE}" logs --tail=40 pratisad-api

echo ""
echo "Deploy complete."
echo "Health: curl -s http://127.0.0.1:4002/health"
echo "Public: curl -s https://api.pratisad.scaleopal.com/health"
