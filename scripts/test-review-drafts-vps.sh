#!/bin/bash
set -euo pipefail

PAYLOAD=$(docker exec pratisad-api node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.business.findFirst({ where: { isActive: true }, select: { slug: true, keywordsRatingHigh: true, keywordsRatingLow: true } })
  .then((b) => {
    if (!b) { console.log(''); return p.\$disconnect(); }
    const defaults = ['Friendly staff','Helpful service','Quick service','Good quality','Clean environment','Good value'];
    const custom = (b.keywordsRatingHigh || []).filter(Boolean);
    const keyword = custom[0] || defaults[0];
    console.log(JSON.stringify({ businessSlug: b.slug, rating: 5, keywords: [keyword], comment: 'Loved it' }));
    return p.\$disconnect();
  });
")

if [ -z "$PAYLOAD" ]; then
  echo "No active business found"
  exit 1
fi

echo "Payload: $PAYLOAD"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -X POST http://127.0.0.1:4002/review-drafts \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
