#!/bin/bash
set -a
source ~/pratisad-api/.env
set +a

for model in gemini-3.5-flash-lite gemini-3.8-flash gemini-3.1-flash-lite gemini-2.5-flash-lite gemini-2.5-flash gemini-2.0-flash gemini-3-flash-preview; do
  echo "=== $model ==="
  curl -s -w " HTTP:%{http_code}\n" \
    "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent" \
    -H "x-goog-api-key: ${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Say hi"}]}],"generationConfig":{"maxOutputTokens":32}}' \
    | head -c 300
  echo
done
