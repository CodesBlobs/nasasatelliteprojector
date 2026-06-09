# Orbital Project Documentation

## Project Overview

**Orbital** is a Space Traffic Control platform that tracks satellites, predicts future positions using orbital mechanics, detects close approaches between objects in orbit, visualizes satellites around Earth in 3D, and provides risk assessments.

Target: NASA and Hack Club competition.

## Technology Stack

- **Frontend:** Next.js 15, React 18, TypeScript, TailwindCSS, TanStack Query, CesiumJS
- **Backend:** NestJS, TypeScript, PostgreSQL, Prisma, Redis, BullMQ
- **Orbital Mechanics:** satellite.js
- **Testing:** Vitest, Supertest
- **Infrastructure:** Docker Compose, Turborepo, pnpm

## Repository Structure

```
orbital/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── shared/       # Shared TypeScript types
│   ├── orbital-core/ # Orbital mechanics library
│   └── config/       # Shared configuration files
├── docker/
├── docs/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

## Key Architectural Decisions

1. **Monorepo with Turborepo:** Fast incremental builds, shared dependencies, single codebase for frontend and backend.

2. **@orbital/shared package:** Single source of truth for API/Web type contracts. Prevents version skew between client and server.

3. **@orbital/core package:** Wraps satellite.js with clean TypeScript interfaces. Separates orbital mechanics logic from domain logic.

4. **Prisma ORM:** Type-safe database queries, migrations, excellent DX for SQL.

5. **PostgreSQL as SSOT:** All orbital data lives in the database. No fake/memory data in production.

6. **NestJS modules by domain:** Clear separation of concerns. Each module owns its logic, controllers, services, DTOs.

7. **Next.js App Router:** Modern React with server components, cleaner routing, better performance.

8. **Docker Compose for local dev:** Environment matches production as closely as possible.

## Development Workflow

### Setup

```bash
pnpm install
docker compose up -d
pnpm db:generate
cd apps/api && pnpm prisma migrate dev --name init
pnpm dev
```

### Available Commands

```bash
pnpm dev          # Start all dev servers
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Lint all code
pnpm format       # Format all code
pnpm db:migrate   # Create a new migration
pnpm db:generate  # Generate Prisma client
```

## Database Schema

### Satellite
- `id` (PK)
- `noradId` (unique)
- `name`
- `operator`
- `country`
- `objectType`
- `createdAt`, `updatedAt`

### TLE
- `id` (PK)
- `satelliteId` (FK)
- `line1`, `line2`
- `epoch`
- Unique constraint: `(satelliteId, epoch)`

### PositionSnapshot
- `id` (PK)
- `satelliteId` (FK)
- `timestamp`
- `x, y, z` (position in km)
- `vx, vy, vz` (velocity in km/s)

### ConjunctionEvent
- `id` (PK)
- `satelliteAId`, `satelliteBId` (FK)
- `closestApproachKm`
- `relativeVelocityKmS`
- `predictedTime`
- `riskScore`, `riskLevel`, `status`
- `createdAt`, `updatedAt`

## API Modules

### Health
- `GET /health` - System status check

### Satellites
- `GET /satellites` - List satellites
- `GET /satellites/:id` - Get by ID
- `GET /satellites/norad/:noradId` - Get by NORAD ID
- `POST /satellites` - Create satellite

### TLE
- `POST /tle/import` - Import TLE lines
- `GET /tle/latest/:satelliteId` - Latest TLE
- `GET /tle/history/:satelliteId` - TLE history

### Placeholder Modules (Phase 2+)
- `propagation/` - Orbital propagation
- `conjunctions/` - Conjunction detection
- `alerts/` - Alert system
- `simulation/` - Simulation engine

## Frontend Pages

- `/` - Dashboard with system status
- `/satellites` - List all satellites
- `/alerts` - Alert monitoring UI
- `/globe` - 3D visualization (Phase 4)

## Development Philosophy

Write code as if it were developed by an experienced human engineering team:

- **Simplicity over abstraction** - Don't over-engineer
- **Realistic structure** - Clear, maintainable patterns
- **Practical decisions** - Why we chose what we chose
- **No boilerplate** - Avoid unnecessary wrappers
- **Production quality** - Code is ready to ship

Avoid:
- Over-commenting (code should be self-documenting)
- Excessive abstraction layers
- Placeholder TODO implementations
- Fake/test data in production paths
- Marketing/onboarding pages

## Important Notes

### Type Safety

- Strict TypeScript mode everywhere
- Shared types in `@orbital/shared` package
- API DTOs are source of truth for client/server contracts

### Database Migrations

- Prisma migrations are versioned in git
- Always create new migrations, never edit old ones
- Run migrations before deployment

### Orbital Mechanics

- satellite.js is the source of truth for propagation
- All calculations use real TLE data
- No mock positions after MVP

### Testing

- Tests are written and kept up to date
- No placeholder test files
- Use Vitest for unit tests
- Use Supertest for API integration tests

## Deployment Notes

- Docker Compose is for development only
- Production deployment uses standard containers
- Environment variables must be set before deploy
- Database migrations run on container startup

## Next Phases

1. **Phase 1** ✅ - Bootstrap (COMPLETE)
2. **Phase 2** - TLE import and validation
3. **Phase 3** - Orbital propagation
4. **Phase 4** - CesiumJS visualization
5. **Phase 5** - Conjunction detection
6. **Phase 6** - Alert system
