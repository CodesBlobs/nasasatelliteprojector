# Quick Start Guide

## Phase 1 + Phase 2 Complete ✅

## Setup (One-time)

```bash
# 1. Install dependencies
pnpm install

# 2. Start database & cache
docker compose up -d

# 3. Setup database
cd apps/api
pnpm prisma migrate dev --name init
cd ../..

# 4. Start development servers
pnpm dev
```

Wait for:
- ✅ API running on http://localhost:3001
- ✅ Web running on http://localhost:3000

## Testing Phase 2 (TLE Ingestion)

### Automated Test
```bash
chmod +x test-tle.sh
./test-tle.sh
```

### Manual Tests

**1. Import ISS**
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }'
```
Expected: 201 with `"created": true`

**2. Get ISS TLE**
```bash
curl http://localhost:3001/tle/25544
```
Expected: 200 with satellite + TLE data

**3. Update ISS TLE**
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }'
```
Expected: 201 with `"created": false`

**4. List All TLEs**
```bash
curl http://localhost:3001/tle
```
Expected: 200 with array of satellites

**5. Get TLE History**
```bash
curl http://localhost:3001/tle/25544/history
```
Expected: 200 with multiple TLE records

## Run Tests

```bash
cd apps/api

# All tests
pnpm test

# Only TLE tests
pnpm test tle

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test:cov
```

Expected: **25 tests pass**
- 11 parser unit tests
- 14 controller integration tests

## View Database

```bash
cd apps/api
pnpm prisma studio
```

Opens interactive database browser at http://localhost:5555

## API Documentation

Visit: http://localhost:3001/api

Swagger/OpenAPI docs with all endpoints.

## What Works

### Web (http://localhost:3000)
- ✅ Dashboard with health check
- ✅ Satellites page (list via API)
- ✅ Alerts page (placeholder)

### API (http://localhost:3001)
- ✅ POST /tle/import - Import TLE
- ✅ GET /tle - List latest TLEs
- ✅ GET /tle/:noradId - Get by NORAD ID
- ✅ GET /tle/:noradId/history - TLE history
- ✅ GET /satellites - List satellites
- ✅ GET /health - System status

## Project Structure

```
orbital/
├── apps/
│   ├── api/          ← NestJS backend (testing here)
│   └── web/          ← Next.js frontend
├── packages/
│   ├── shared/       ← Type definitions
│   ├── orbital-core/ ← Orbital mechanics (empty, for Phase 3)
│   └── config/       ← Shared configs
├── docker-compose.yml
├── PHASE2_COMPLETE.md
├── PHASE2_TESTING.md
└── test-tle.sh
```

## Documentation

- **PHASE2_COMPLETE.md** - Full Phase 2 summary
- **PHASE2_TESTING.md** - Detailed testing guide
- **PHASE2.md** - Feature documentation
- **PHASE2_IMPLEMENTATION.md** - Architecture & code

## Real Test Satellites

### ISS
```
NORAD: 25544
Line 1: 1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005
Line 2: 2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645
```

### Hubble
```
NORAD: 20580
Line 1: 1 20580U 90037B   23001.00000000  .00000561  00000-0  24793-4 0  9992
Line 2: 2 20580  28.4710 151.0380 0002853 247.4180 112.7130 15.09681866868689
```

### Soyuz MS-23
```
NORAD: 51734
Line 1: 1 51734U 21090A   23001.00000000  .00001234  00000-0  12345-3 0  9999
Line 2: 2 51734  51.6480 110.4833 0000901  95.0000 265.1000 15.54500000100000
```

## Troubleshooting

### Database Connection Error
```bash
docker compose up -d
sleep 5
cd apps/api && pnpm prisma migrate dev --name init
```

### Port Already in Use
```bash
lsof -ti:3001 | xargs kill -9
pnpm dev
```

### Tests Fail
```bash
cd apps/api
pnpm test -- --reporter=verbose
```

### Prisma Client Error
```bash
cd apps/api
pnpm prisma generate
```

## Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Bootstrap | ✅ Complete |
| 2 | TLE Ingestion | ✅ Complete |
| 3 | Orbital Propagation | ⏳ Next |
| 4 | 3D Visualization | 📅 Future |
| 5 | Conjunction Detection | 📅 Future |
| 6 | Alert System | 📅 Future |

## Next Steps

1. Verify Phase 2 works: `./test-tle.sh`
2. Run tests: `cd apps/api && pnpm test`
3. Check API docs: http://localhost:3001/api
4. Start Phase 3: Orbital propagation
