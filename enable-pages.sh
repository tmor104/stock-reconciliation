#!/bin/bash
# Script to enable GitHub Pages via API
# Note: This may require Pages to be enabled through web UI first

REPO="tmor104/stock-reconciliation"
TOKEN=$(gh auth token)

echo "Attempting to enable GitHub Pages for $REPO..."

# Try to enable Pages
RESPONSE=$(curl -s -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/pages" \
  -d '{"source":{"type":"branch","branch":"main","path":"/"}}')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check status
sleep 3
echo ""
echo "Checking Pages status..."
STATUS=$(curl -s \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/pages")

echo "$STATUS" | jq '.' 2>/dev/null || echo "$STATUS"


