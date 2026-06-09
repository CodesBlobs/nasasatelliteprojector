#!/bin/bash

set -e

API_URL="http://localhost:3001"

echo "🧪 TLE Ingestion Testing"
echo "========================"
echo ""

# Test 1: Import ISS
echo "1️⃣  Importing ISS TLE..."
RESPONSE=$(curl -s -X POST "$API_URL/tle/import" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
    "country": "Russia",
    "operator": "RKA"
  }')

echo "$RESPONSE" | jq .
ISS_CREATED=$(echo "$RESPONSE" | jq -r '.created')
echo "✅ Created: $ISS_CREATED"
echo ""

# Test 2: Get ISS TLE
echo "2️⃣  Getting ISS TLE..."
curl -s "$API_URL/tle/25544" | jq .
echo ""

# Test 3: Import Hubble
echo "3️⃣  Importing Hubble Space Telescope..."
curl -s -X POST "$API_URL/tle/import" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HUBBLE SPACE TELESCOPE",
    "line1": "1 20580U 90037B   23001.00000000  .00000561  00000-0  24793-4 0  9992",
    "line2": "2 20580  28.4710 151.0380 0002853 247.4180 112.7130 15.09681866868689",
    "country": "USA",
    "operator": "NASA"
  }' | jq .
echo ""

# Test 4: List all TLEs
echo "4️⃣  Listing all TLEs..."
curl -s "$API_URL/tle" | jq '.[0]'
echo ""

# Test 5: Update ISS (re-import)
echo "5️⃣  Updating ISS TLE..."
RESPONSE=$(curl -s -X POST "$API_URL/tle/import" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
    "country": "Russia",
    "operator": "RKA"
  }')

echo "$RESPONSE" | jq .
ISS_UPDATED=$(echo "$RESPONSE" | jq -r '.created')
echo "✅ Created (should be false): $ISS_UPDATED"
echo ""

# Test 6: Get ISS history
echo "6️⃣  Getting ISS TLE history..."
curl -s "$API_URL/tle/25544/history?limit=10" | jq '.tles | length'
echo "✅ Got TLE history"
echo ""

# Test 7: Invalid TLE
echo "7️⃣  Testing invalid TLE rejection..."
RESPONSE=$(curl -s -X POST "$API_URL/tle/import" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "INVALID",
    "line1": "INVALID",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }')

echo "$RESPONSE" | jq .
ERROR=$(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)
if [[ $ERROR == *"Invalid"* ]]; then
  echo "✅ Correctly rejected invalid TLE"
else
  echo "❌ Should have rejected invalid TLE"
fi
echo ""

echo "✅ All tests complete!"
