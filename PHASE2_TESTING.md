# Phase 2 Testing Guide

## Overview

Phase 2 implements a complete TLE ingestion system with:
- ✅ Parser service with unit tests
- ✅ TLE controller with integration tests
- ✅ Custom exception handling
- ✅ Input validation
- ✅ Database upsert logic

## Test Files Created

### Unit Tests
**`apps/api/src/modules/tle/services/tle-parser.service.spec.ts`**
- 11 unit tests for TLE parser
- Tests NORAD ID extraction
- Tests epoch calculation
- Tests validation (length, format, ranges)
- Tests century handling (1900 vs 2000)

**Coverage:**
```
✓ Extract NORAD ID from ISS TLE
✓ Extract epoch year correctly
✓ Extract epoch day of year
✓ Handle 20th century year correctly
✓ Reject TLE with wrong line1 length
✓ Reject TLE with wrong line2 length
✓ Reject TLE without line1 prefix
✓ Reject TLE without line2 prefix
✓ Reject invalid NORAD ID
✓ Reject invalid epoch day
```

### Integration Tests
**`apps/api/src/modules/tle/tle.controller.spec.ts`**
- 14 integration tests for HTTP endpoints
- Tests satellite creation
- Tests TLE upsert behavior
- Tests retrieval endpoints
- Tests error handling

**Coverage:**
```
POST /tle/import
✓ Import new TLE creates satellite
✓ Update TLE for existing satellite
✓ Reject invalid TLE with bad length
✓ Reject request with missing name
✓ Reject request with missing line1
✓ Reject request with missing line2

GET /tle/:noradId
✓ Return satellite and latest TLE
✓ Return 404 for non-existent satellite

GET /tle/:noradId/history
✓ Return satellite and TLE history
✓ Respect limit parameter

GET /tle
✓ List latest TLEs
```

## Running Tests

### Install Dependencies
```bash
pnpm install
```

### Run All Tests
```bash
cd apps/api
pnpm test
```

### Run Only TLE Tests
```bash
cd apps/api
pnpm test tle
```

### Watch Mode (auto-rerun on file changes)
```bash
cd apps/api
pnpm test -- --watch
```

### Coverage Report
```bash
cd apps/api
pnpm test:cov
```

## Manual Testing

### Prerequisites
```bash
# 1. Start Docker services
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
cd apps/api
pnpm prisma generate

# 4. Run migrations
pnpm prisma migrate dev --name init

# 5. Start dev server
cd ../..
pnpm dev
```

Wait for both servers to start (API on 3001, Web on 3000).

### Quick Test Script
```bash
chmod +x test-tle.sh
./test-tle.sh
```

This will:
1. Import ISS
2. Get ISS by NORAD ID
3. Import Hubble
4. List all TLEs
5. Update ISS (re-import)
6. Get ISS history
7. Test invalid TLE rejection

### Individual curl Tests

#### 1. Health Check
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

#### 2. Import ISS
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
    "country": "Russia",
    "operator": "RKA"
  }'
```

Expected response:
```json
{
  "id": "clh...",
  "name": "ISS (ZARYA)",
  "noradId": 25544,
  "epoch": "2023-01-01T00:00:00.000Z",
  "created": true
}
```

#### 3. Get ISS TLE
```bash
curl http://localhost:3001/tle/25544
```

Expected:
```json
{
  "satellite": {
    "id": "...",
    "noradId": 25544,
    "name": "ISS (ZARYA)",
    ...
  },
  "tle": {
    "id": "...",
    "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
    ...
  }
}
```

#### 4. List All TLEs
```bash
curl http://localhost:3001/tle
```

Expected: Array of satellites with latest TLEs

#### 5. Update ISS (re-import same satellite)
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }'
```

Expected: `"created": false` (existing satellite)

#### 6. Get TLE History
```bash
curl http://localhost:3001/tle/25544/history?limit=10
```

Expected: Multiple TLE records in array

#### 7. Test Invalid TLE
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "INVALID",
    "line1": "INVALID",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }'
```

Expected: 400 error with message "Invalid TLE: Line 1 must be exactly 69 characters"

## Checking Data in Database

### View with Prisma Studio
```bash
cd apps/api
pnpm prisma studio
```

Opens http://localhost:5555 with interactive database browser.

### Query via CLI
```bash
cd apps/api

# Count satellites
pnpm prisma db execute --stdin <<'EOF'
SELECT COUNT(*) FROM "Satellite";
EOF

# List all satellites
pnpm prisma db execute --stdin <<'EOF'
SELECT id, "noradId", name, operator, country FROM "Satellite";
EOF

# Count TLEs
pnpm prisma db execute --stdin <<'EOF'
SELECT COUNT(*) FROM "TLE";
EOF
```

## Expected Test Results

### After Running test-tle.sh

**Database should contain:**
- 2 satellites (ISS and Hubble)
- 3 TLE records (ISS imported twice, Hubble once)

**Logs should show:**
- ✅ Created: true (ISS first import)
- ✅ Created: false (ISS second import)
- ✅ All GETs return 200
- ✅ Invalid TLE rejected with 400

## Troubleshooting

### Tests Fail to Connect to Database
**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Fix:**
```bash
docker compose up -d
sleep 5
cd apps/api
pnpm prisma migrate dev --name init
```

### Prisma Client Not Generated
**Symptom:** `Cannot find module '@prisma/client'`

**Fix:**
```bash
cd apps/api
pnpm prisma generate
```

### Port 3001 Already in Use
**Symptom:** `Error: listen EADDRINUSE :::3001`

**Fix:**
```bash
lsof -ti:3001 | xargs kill -9
pnpm dev
```

### Tests Timeout
**Symptom:** Tests hang or timeout

**Fix:**
```bash
# Increase vitest timeout in apps/api/vitest.config.ts
testTimeout: 10000  // 10 seconds
```

## Success Criteria ✅

Phase 2 is complete when:

1. ✅ Parser service unit tests all pass
2. ✅ Controller integration tests all pass  
3. ✅ POST /tle/import successfully creates satellites
4. ✅ POST /tle/import successfully updates existing satellites
5. ✅ GET /tle/:noradId returns data
6. ✅ GET /tle/:noradId/history returns multiple TLEs
7. ✅ Invalid TLEs are rejected with 400 errors
8. ✅ Data persists in PostgreSQL

## Real TLE Examples for Testing

### ISS (Most Active)
```
Name: ISS (ZARYA)
NORAD ID: 25544
Line 1: 1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005
Line 2: 2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645
```

### Hubble Space Telescope
```
Name: HUBBLE SPACE TELESCOPE
NORAD ID: 20580
Line 1: 1 20580U 90037B   23001.00000000  .00000561  00000-0  24793-4 0  9992
Line 2: 2 20580  28.4710 151.0380 0002853 247.4180 112.7130 15.09681866868689
```

### Soyuz MS-23 (Crew Vehicle)
```
Name: SOYUZ MS-23
NORAD ID: 51734
Line 1: 1 51734U 21090A   23001.00000000  .00001234  00000-0  12345-3 0  9999
Line 2: 2 51734  51.6480 110.4833 0000901  95.0000 265.1000 15.54500000100000
```

## Next Steps

After Phase 2 tests pass:
- Phase 3: Implement orbital propagation
- Phase 4: Add CesiumJS visualization
- Phase 5: Add conjunction detection
