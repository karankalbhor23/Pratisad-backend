#!/bin/bash
set -a
source ~/pratisad-api/.env
set +a

echo "=== gemini-3.5-flash-lite with thinkingBudget:0 ==="
curl -s -w "\nHTTP:%{http_code}\n" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hi"}]}],"generationConfig":{"maxOutputTokens":64,"thinkingConfig":{"thinkingBudget":0}}}' | head -c 400

echo
echo "=== gemini-3.5-flash-lite with no thinkingConfig ==="
curl -s -w "\nHTTP:%{http_code}\n" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hi"}]}],"generationConfig":{"maxOutputTokens":64}}' | head -c 400

echo
echo "=== gemini-3.5-flash-lite with thinkingLevel:low ==="
curl -s -w "\nHTTP:%{http_code}\n" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hi"}]}],"generationConfig":{"maxOutputTokens":64,"thinkingConfig":{"thinkingLevel":"low"}}}' | head -c 400
