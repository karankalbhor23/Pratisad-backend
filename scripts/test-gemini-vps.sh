#!/bin/bash
set -euo pipefail
set -a
source ~/pratisad-api/.env
set +a

echo "=== GEMINI_MODEL=${GEMINI_MODEL:-unset} ==="

echo "=== Direct Gemini test (gemini-2.5-flash-lite) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in one word"}]}],"generationConfig":{"maxOutputTokens":64}}'

echo
echo "=== Review drafts API test ==="
SLUG=$(curl -s http://127.0.0.1:4002/businesses | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['slug'] if d else '')" 2>/dev/null || true)
if [ -z "$SLUG" ]; then
  echo "No business slug found; skipping API test"
  exit 0
fi
echo "Using business slug: $SLUG"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -X POST http://127.0.0.1:4002/review-drafts \
  -H "Content-Type: application/json" \
  -d "{\"businessSlug\":\"$SLUG\",\"rating\":5,\"keywords\":[\"Great service\"],\"comment\":\"Loved it\"}"
