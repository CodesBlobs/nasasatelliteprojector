# Orbital - Space Traffic Control Platform

Real-time satellite tracking, orbital mechanics propagation, and conjunction detection for space traffic management.

## Architecture

Monorepo structure using Turborepo and pnpm workspaces:

```
apps/
  ├── api/        # NestJS backend
  └── web/        # Next.js frontend

packages/
  ├── shared/     # Shared types
  ├── orbital-core/  # Orbital mechanics library
  └── config/     # Shared configs (TS, ESLint, etc.)
```

## Tech Stack

**Backend:** NestJS, PostgreSQL, Prisma, Redis
**Frontend:** Next.js, React, TailwindCSS, TanStack Query
**Orbital Mechanics:** satellite.js
**Infrastructure:** Docker Compose, Turborepo

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start services

```bash
docker compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 3. Setup database

```bash
pnpm db:generate
cd apps/api && pnpm prisma migrate dev --name init
```

### 4. Start development servers

```bash
pnpm dev
```

This will start:
- API on `http://localhost:3001`
- Web on `http://localhost:3000`

### 5. Access the application

- **Web UI:** http://localhost:3000
- **API Docs:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/health

## Project Structure

### API (`apps/api`)

NestJS application with modular architecture:

- `health` - System health checks
- `satellites` - Satellite records
- `tle` - Two-Line Element imports and parsing
- `propagation` - Orbital propagation (Phase 3)
- `conjunctions` - Conjunction detection (Phase 5)
- `alerts` - Alert system (Phase 6)
- `simulation` - Simulation engine

Database models:
- `Satellite` - Satellite metadata
- `TLE` - Two-Line Elements
- `PositionSnapshot` - Calculated positions
- `ConjunctionEvent` - Detected conjunctions

### Web (`apps/web`)

Next.js frontend with clean engineering dashboard:

- `/` - Dashboard with system status
- `/satellites` - Satellite listing
- `/alerts` - Alert monitoring
- `/globe` - 3D visualization (Phase 4)

### Shared Packages

- `@orbital/shared` - TypeScript types and interfaces
- `@orbital/core` - TLE parsing, orbital propagation

## API Endpoints

### Health

```
GET /health
```

### Satellites

```
GET /satellites?skip=0&take=100          # List satellites
GET /satellites/:id                      # Get by ID
GET /satellites/norad/:noradId           # Get by NORAD ID
POST /satellites                         # Create satellite
```

### TLE

```
POST /tle/import                         # Import TLE
GET /tle/latest/:satelliteId             # Latest TLE
GET /tle/history/:satelliteId            # TLE history
```

## Development

### Run tests

```bash
pnpm test
```

### Format code

```bash
pnpm format
```

### Lint

```bash
pnpm lint
```

### Build for production

```bash
pnpm build
```

## Environment Variables

See `.env.example` for all options:

```bash
cp .env.example .env
```

API environment (`apps/api/.env`):
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `API_PORT` - API server port
- `NODE_ENV` - Environment

Web environment (`apps/web/.env.local`):
- `NEXT_PUBLIC_API_URL` - API endpoint

## Database

Using Prisma ORM with PostgreSQL.

### Create migration

```bash
cd apps/api
pnpm prisma migrate dev --name <migration-name>
```

### View database

```bash
cd apps/api
pnpm prisma studio
```

## Phases

### Phase 1 ✅ (Current)
- Bootstrap monorepo
- NestJS API with health endpoint
- Next.js frontend with pages
- Prisma database schema
- Docker Compose setup

### Phase 2
- TLE import endpoint
- Validation and parsing
- Tests

### Phase 3
- Orbital propagation with satellite.js
- Position calculation API

### Phase 4
- CesiumJS integration
- 3D Earth visualization
- Real-time satellite rendering

### Phase 5
- Conjunction detection algorithm
- Risk assessment

### Phase 6
- Alert system
- Dashboard alerts UI

## License

MIT
