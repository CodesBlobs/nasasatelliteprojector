

# 🚀 Orbital - Space Tracker Thingy

This is a project that tracks satellites in real time, shows where they are in space, and checks if they might crash into each other (scary stuff 😬).

## 🧠 What it does

* Tracks satellites orbiting Earth
* Predicts where they’ll go next
* Warns if two satellites might get too close
* Shows everything in a simple dashboard

---

## 🧱 How it’s built

It’s a big project with a few parts:

```
apps/
  ├── api (the brain / backend)
  └── web (the website you see)

packages/
  ├── shared (stuff both sides use)
  ├── orbital-core (space math stuff 🪐)
  └── config (settings so everything behaves)
```

---

## 🛠️ Tech used

* Backend: NestJS, PostgreSQL, Redis
* Frontend: Next.js, React, TailwindCSS
* Space math: satellite.js (for orbit calculations)
* Dev tools: Docker, Turborepo

Basically: a mix of web dev + space nerd stuff.

---

## ⚡ How to run it

### 1. Install stuff

```bash
pnpm install
```

### 2. Start database + Redis

```bash
docker compose up -d
```

This starts:

* Database (Postgres)
* Cache (Redis)

---

### 3. Set up database

```bash
pnpm db:generate
cd apps/api && pnpm prisma migrate dev --name init
```

---

### 4. Start the project

```bash
pnpm dev
```

Now it runs:

* Website → [http://localhost:3000](http://localhost:3000)
* API → [http://localhost:3001](http://localhost:3001)

---

## 📦 What’s inside

### 🧠 Backend (API)

Handles all the logic like:

* satellites
* space data (TLEs)
* orbit predictions
* collision warnings (future feature 👀)

### 🌐 Frontend (Web)

A dashboard where you can:

* see satellites
* check alerts
* maybe eventually see a 3D Earth (cool stuff)

---

## 🧪 Features (in progress)

### ✅ Done

* Basic backend setup
* Basic frontend
* Database connected

### 🚧 Coming soon

* Import satellite data
* Orbit calculations
* 3D Earth view 🌍
* Collision warnings 🚨
* Live updates

---

## 📄 License

MIT (Don't sue me pls i'm not rich)