# Conjunction Detection — Scaling Plan

## Current MVP (Phase 4)

The detector (`apps/api/src/modules/conjunctions/conjunction-detector.ts`) is a
brute-force pairwise scan:

- Propagate every satellite with a TLE at 5-minute steps over a 24-hour window
  (289 samples).
- For each of the n(n-1)/2 pairs, track the minimum separation across all
  samples.
- Record a `ConjunctionEvent` when the minimum is below 10 km.

Cost: O(n · steps) SGP4 propagations + O(n² · steps) distance checks.
At the MVP target of 100–500 objects this is ~145k propagations and ~36M
distance checks — a few seconds of synchronous CPU, fine behind a
`POST /conjunctions/scan` endpoint.

This stops being acceptable around a few thousand objects: 10k objects means
~14.5M propagations and ~14.5 billion distance checks per scan.

## Scaling stages

### 1. Cheap pre-filters (10x–100x, no new infrastructure)

Most pairs can never conjunct and can be rejected once per scan, not per step:

- **Apogee/perigee overlap:** if `perigee(A) - apogee(B) > threshold` (or vice
  versa) the orbits' radial shells never intersect. Computed directly from TLE
  mean motion and eccentricity. This alone removes the vast majority of
  LEO×GEO and LEO×MEO pairs.
- **Orbit grouping:** bucket objects by altitude band (e.g. 25 km shells) and
  only compare adjacent buckets. This is the orbital equivalent of a uniform
  grid and pairs naturally with the apogee/perigee test.

### 2. Spatial partitioning per timestep (n² → n log n)

When pairwise checking within a timestep is still too large:

- **KD-tree / octree:** insert all positions for the step, then range-query
  each object for neighbours within the threshold. Build is O(n log n),
  queries are O(log n) each.
- **Uniform grid hashing** is simpler and usually faster for this workload:
  hash positions into 10 km cells and only compare objects in the same or
  neighbouring cells (27-cell stencil). Distance threshold == cell size makes
  correctness easy to reason about.

### 3. Smarter time sampling

Fixed 5-minute sampling can miss fast crossings (relative velocities reach
~15 km/s, i.e. ~4500 km between samples). Production approach:

- Coarse pass to find candidate pairs and approximate times (stages 1–2).
- Fine pass per candidate: golden-section or Newton refinement of the
  distance-vs-time function around the coarse minimum, down to sub-second
  accuracy. This is also where the stored `closestApproachKm` becomes
  trustworthy enough for risk scoring.

### 4. Workers and queues (beyond a single request)

A full-catalog scan does not belong in an HTTP request handler:

- Move scans to a **BullMQ** queue (already in the stack) with a repeatable
  job (e.g. every 6 hours, and after each TLE ingest).
- Shard the pair space across workers (by altitude bucket) — the problem is
  embarrassingly parallel after stage 1.
- The API then only ever reads precomputed `ConjunctionEvent` rows, which is
  already how the frontend consumes them, so no client changes are needed.

### 5. Beyond (not planned)

Industry-grade systems use covariance-based probability of collision (Pc)
instead of pure miss distance, and ingest operator CDMs. Out of scope for this
project; the `riskScore` field is the seam where Pc would slot in.
