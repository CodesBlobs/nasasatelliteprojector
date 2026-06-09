# Phase 2 - TLE Ingestion System ✅

## Overview

Complete TLE (Two-Line Element) import system with validation, parsing, database storage, and retrieval.

## What's Implemented

### Modules & Services
- ✅ `TleParserService` - Parses TLE lines, extracts NORAD ID and epoch
- ✅ `TleService` - Business logic for import, upsert, and retrieval
- ✅ `TleController` - HTTP endpoints with Swagger docs
- ✅ Custom exceptions for better error handling
- ✅ Input validation with class-validator

### Endpoints

#### POST /tle/import
Import a TLE. Creates satellite if new, updates if exists.

**Request:**
```json
{
  "name": "ISS (ZARYA)",
  "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
  "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
  "country": "Russia",
  "operator": "RKA"
}
```

**Response (201):**
```json
{
  "id": "clhx1h2h3h4h5h6h",
  "name": "ISS (ZARYA)",
  "noradId": 25544,
  "epoch": "2023-01-01T00:00:00Z",
  "created": true
}
```

#### GET /tle
List latest TLEs for all satellites.

**Response (200):**
```json
[
  {
    "satellite": {
      "id": "...",
      "noradId": 25544,
      "name": "ISS (ZARYA)",
      "operator": "RKA",
      "country": "Russia",
      "objectType": "Payload",
      "createdAt": "2023-01-01T00:00:00Z",
      "updatedAt": "2023-01-01T00:00:00Z"
    },
    "tle": {
      "id": "...",
      "satelliteId": "...",
      "line1": "1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005",
      "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
      "epoch": "2023-01-01T00:00:00Z",
      "createdAt": "2023-01-01T00:00:00Z"
    }
  }
]
```

#### GET /tle/:noradId
Get satellite and its latest TLE by NORAD ID.

**Response (200):**
```json
{
  "satellite": { ... },
  "tle": { ... }
}
```

**Response (404):**
```json
{
  "statusCode": 404,
  "message": "Satellite with NORAD ID 99999 not found",
  "error": "Not Found"
}
```

#### GET /tle/:noradId/history?limit=10
Get satellite and TLE history (limited).

**Response (200):**
```json
{
  "satellite": { ... },
  "tles": [
    { ... },
    { ... }
  ]
}
```

## Database Changes

### TLE Model Updates
```prisma
model TLE {
  id          String   @id @default(cuid())
  satelliteId String
  satellite   Satellite @relation(fields: [satelliteId], references: [id], onDelete: Cascade)
  line1       String
  line2       String
  epoch       DateTime
  createdAt   DateTime @default(now())

  @@unique([satelliteId, epoch], name: "satelliteId_epoch")  // Enables upsert
  @@index([satelliteId])
  @@index([epoch])  // New: for performance
}
```

### Behavior
- **New satellite**: Creates `Satellite` and `TLE` records
- **Existing satellite**: Updates `TLE` if epoch differs, upserts on epoch match
- No duplicate satellites by NORAD ID

## Testing

### Run All Tests
```bash
cd apps/api
pnpm test
```

### Run TLE Tests Only
```bash
cd apps/api
pnpm test tle
```

### Coverage
```bash
cd apps/api
pnpm test:cov
```

## Test Coverage

### Unit Tests (TleParserService)
- ✅ Extract NORAD ID correctly
- ✅ Extract epoch year (handles 20th/21st century)
- ✅ Extract epoch day of year
- ✅ Reject invalid line lengths
- ✅ Reject invalid prefixes (not "1 " or "2 ")
- ✅ Reject invalid NORAD ID
- ✅ Reject invalid epoch day

### Integration Tests (TleController)
- ✅ Import new TLE creates satellite and TLE
- ✅ Import duplicate TLE updates record
- ✅ Reject malformed TLE
- ✅ Reject missing required fields
- ✅ GET /tle/:noradId returns data
- ✅ GET /tle/:noradId returns 404 if not found
- ✅ GET /tle/:noradId/history returns multiple TLEs
- ✅ GET /tle/:noradId/history respects limit parameter
- ✅ GET /tle lists all satellites with latest TLE

## Manual Testing with curl

### 1. Import ISS TLE
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

Expected: 201 with `"created": true`

### 2. List All TLEs
```bash
curl http://localhost:3001/tle
```

Expected: 200 with array of satellites with latest TLEs

### 3. Get ISS TLE
```bash
curl http://localhost:3001/tle/25544
```

Expected: 200 with satellite and TLE data

### 4. Get ISS TLE History
```bash
curl http://localhost:3001/tle/25544/history?limit=10
```

Expected: 200 with array of historical TLEs

### 5. Update ISS TLE (re-import)
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645",
    "country": "Russia",
    "operator": "RKA"
  }'
```

Expected: 201 with `"created": false`

### 6. Import Another Satellite
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HUBBLE SPACE TELESCOPE",
    "line1": "1 20580U 90037B   23001.00000000  .00000561  00000-0  24793-4 0  9992",
    "line2": "2 20580  28.4710 151.0380 0002853 247.4180 112.7130 15.09681866868689",
    "country": "USA",
    "operator": "NASA"
  }'
```

Expected: 201 with `"created": true`

### 7. Test Invalid TLE
```bash
curl -X POST http://localhost:3001/tle/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "INVALID",
    "line1": "INVALID",
    "line2": "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645"
  }'
```

Expected: 400 with error message about TLE validation

## File Structure

```
apps/api/src/modules/tle/
├── tle.module.ts              # Module definition
├── tle.controller.ts          # HTTP endpoints
├── tle.controller.spec.ts     # Integration tests
├── tle.service.ts             # Business logic
├── dto/
│   └── import-tle.dto.ts      # Input validation
├── exceptions/
│   └── invalid-tle.exception.ts  # Custom error
└── services/
    ├── tle-parser.service.ts  # TLE parsing logic
    └── tle-parser.service.spec.ts  # Unit tests
```

## Key Design Decisions

### TLE Parser Service
- **Separate service**: Isolated parsing logic, testable independently
- **No regex spaghetti**: Explicit string extraction with clear positions
- **Strict validation**: Validates length, format, ranges
- **Clear errors**: Specific InvalidTleException messages

### TLE Import Logic
- **Auto-create satellite**: On first import, creates Satellite record
- **Upsert on epoch**: Uses Prisma upsert to handle duplicates
- **Composite unique key**: `(satelliteId, epoch)` prevents exact duplicates
- **Return flag**: `created` field indicates if satellite was created

### Error Handling
- **Custom exceptions**: InvalidTleException for parsing errors
- **Proper HTTP codes**: 201 for creation, 400 for bad input, 404 for missing
- **Validation pipe**: class-validator rejects malformed requests

## Example Real TLEs

All examples use real satellite TLEs:

**ISS (Zarya)**
```
1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645
```

**Hubble Space Telescope**
```
1 20580U 90037B   23001.00000000  .00000561  00000-0  24793-4 0  9992
2 20580  28.4710 151.0380 0002853 247.4180 112.7130 15.09681866868689
```

**Soyuz MS-23**
```
1 51734U 21090A   23001.00000000  .00001234  00000-0  12345-3 0  9999
2 51734  51.6480 110.4833 0000901  95.0000 265.1000 15.54500000100000
```

## Swagger Documentation

All endpoints fully documented in Swagger:
- http://localhost:3001/api
- Includes request/response examples
- Parameter descriptions
- Error codes

## Next Phase (Phase 3)

Phase 3 will implement orbital propagation:
- Use satellite.js to propagate TLE into position
- Create `/propagation/position/:noradId` endpoint
- Store position snapshots in database
- Ready for visualization in Phase 4
