import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { ConjunctionsModule } from './conjunctions.module'
import { PrismaService } from '../../common/prisma/prisma.service'

// Real ISS TLE (epoch 2026-06-09). Both test satellites share the same orbit so a
// conjunction is guaranteed; the third is phase-shifted 180° so it never gets close.
const ISS_LINE1 = '1 25544U 98067A   26160.50000000  .00016717  00000-0  29770-3 0  9002'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'
const ISS_LINE2_OPPOSITE = '2 25544  51.6416 247.4627 0006703 130.5360 145.0288 15.54179074380645'

const TLE_EPOCH = new Date('2026-06-09T12:00:00Z')
const SCAN_BODY = { windowHours: 1, sampleMinutes: 5 }

describe('Conjunctions Controller (Integration)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConjunctionsModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    )
    await app.init()

    prisma = moduleFixture.get<PrismaService>(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await prisma.conjunctionEvent.deleteMany({})
    await prisma.tLE.deleteMany({})
    await prisma.satellite.deleteMany({})

    const seed = [
      { noradId: 25544, name: 'ISS (ZARYA)', line2: ISS_LINE2 },
      { noradId: 90001, name: 'TEST OBJECT A', line2: ISS_LINE2 },
      { noradId: 90002, name: 'TEST OBJECT B', line2: ISS_LINE2_OPPOSITE },
    ]
    for (const { noradId, name, line2 } of seed) {
      await prisma.satellite.create({
        data: {
          noradId,
          name,
          objectType: 'Payload',
          tle: { create: { line1: ISS_LINE1, line2, epoch: TLE_EPOCH } },
        },
      })
    }
  })

  describe('POST /conjunctions/scan', () => {
    it('detects and stores the close pair, ignoring the distant one', async () => {
      const res = await request(app.getHttpServer())
        .post('/conjunctions/scan')
        .send(SCAN_BODY)
        .expect(200)

      expect(res.body.scannedSatellites).toBe(3)
      expect(res.body.eventsCreated).toBe(1)

      const stored = await prisma.conjunctionEvent.findMany({
        include: { satelliteA: true, satelliteB: true },
      })
      expect(stored).toHaveLength(1)
      expect(stored[0].closestApproachKm).toBeLessThan(0.001)
      expect(stored[0].riskLevel).toBe('CRITICAL')
      expect(stored[0].status).toBe('PREDICTED')
      const pair = [stored[0].satelliteA.noradId, stored[0].satelliteB.noradId].sort()
      expect(pair).toEqual([25544, 90001])
    })

    it('does not duplicate events when run twice', async () => {
      await request(app.getHttpServer()).post('/conjunctions/scan').send(SCAN_BODY).expect(200)
      await request(app.getHttpServer()).post('/conjunctions/scan').send(SCAN_BODY).expect(200)

      const count = await prisma.conjunctionEvent.count()
      expect(count).toBe(1)
    })

    it('rejects an out-of-range window', async () => {
      await request(app.getHttpServer())
        .post('/conjunctions/scan')
        .send({ windowHours: 1000 })
        .expect(400)
    })
  })

  describe('GET /conjunctions', () => {
    it('returns events with satellite summaries', async () => {
      await request(app.getHttpServer()).post('/conjunctions/scan').send(SCAN_BODY).expect(200)

      const res = await request(app.getHttpServer()).get('/conjunctions').expect(200)

      expect(res.body).toHaveLength(1)
      const event = res.body[0]
      expect(typeof event.closestApproachKm).toBe('number')
      expect(typeof event.relativeVelocityKmS).toBe('number')
      expect(event.predictedTime).toBeDefined()
      expect(event.riskLevel).toBe('CRITICAL')
      expect(event.satelliteA.noradId).toBeDefined()
      expect(event.satelliteA.name).toBeDefined()
      expect(event.satelliteB.noradId).toBeDefined()
    })

    it('returns an empty array when no conjunctions exist', async () => {
      const res = await request(app.getHttpServer()).get('/conjunctions').expect(200)
      expect(res.body).toEqual([])
    })
  })

  describe('GET /conjunctions/active', () => {
    it('excludes resolved events', async () => {
      await request(app.getHttpServer()).post('/conjunctions/scan').send(SCAN_BODY).expect(200)

      let res = await request(app.getHttpServer()).get('/conjunctions/active').expect(200)
      expect(res.body).toHaveLength(1)

      await prisma.conjunctionEvent.updateMany({ data: { status: 'RESOLVED' } })

      res = await request(app.getHttpServer()).get('/conjunctions/active').expect(200)
      expect(res.body).toHaveLength(0)

      // Resolved events still appear in the full list
      res = await request(app.getHttpServer()).get('/conjunctions').expect(200)
      expect(res.body).toHaveLength(1)
    })
  })

  describe('GET /conjunctions/:id', () => {
    it('returns full event details', async () => {
      await request(app.getHttpServer()).post('/conjunctions/scan').send(SCAN_BODY).expect(200)
      const event = await prisma.conjunctionEvent.findFirstOrThrow()

      const res = await request(app.getHttpServer()).get(`/conjunctions/${event.id}`).expect(200)

      expect(res.body.id).toBe(event.id)
      expect(res.body.satelliteA.name).toBeDefined()
      expect(res.body.satelliteB.name).toBeDefined()
      expect(res.body.riskScore).toBeGreaterThan(99)
    })

    it('returns 404 for an unknown event', async () => {
      const res = await request(app.getHttpServer()).get('/conjunctions/unknown-id').expect(404)
      expect(res.body.error).toBe('ConjunctionNotFound')
    })
  })
})
