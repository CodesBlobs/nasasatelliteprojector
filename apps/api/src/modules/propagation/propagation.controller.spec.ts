import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { PropagationModule } from './propagation.module'
import { TleModule } from '../tle/tle.module'
import { PrismaService } from '../../common/prisma/prisma.service'
import request from 'supertest'

const ISS_NORAD = 25544

// TLE with epoch 2026-06-09 (day 160.5) so SGP4 propagates correctly at test runtime
const issImportPayload = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   26160.50000000  .00016717  00000-0  29770-3 0  9002',
  line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645',
  country: 'Russia',
  operator: 'RKA',
}

const NEAR_EPOCH = '2026-06-09T12:00:00Z'

describe('Propagation Controller (Integration)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PropagationModule, TleModule],
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
    await prisma.positionSnapshot.deleteMany({})
    await prisma.tLE.deleteMany({})
    await prisma.satellite.deleteMany({})

    // Seed ISS via TLE import
    await request(app.getHttpServer()).post('/tle/import').send(issImportPayload).expect(201)
  })

  describe('GET /satellites/:noradId/position', () => {
    it('returns current position for ISS', async () => {
      const res = await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/position`)
        .expect(200)

      expect(res.body.noradId).toBe(ISS_NORAD)
      expect(res.body.timestamp).toBeDefined()
      expect(typeof res.body.position.x).toBe('number')
      expect(typeof res.body.position.y).toBe('number')
      expect(typeof res.body.position.z).toBe('number')
      expect(typeof res.body.velocity.x).toBe('number')
      expect(typeof res.body.velocity.y).toBe('number')
      expect(typeof res.body.velocity.z).toBe('number')
    })

    it('returns position at a specific ISO timestamp', async () => {
      const res = await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/position?time=${NEAR_EPOCH}`)
        .expect(200)

      expect(new Date(res.body.timestamp).toISOString()).toBe(new Date(NEAR_EPOCH).toISOString())
    })

    it('returns 404 for unknown NORAD ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/satellites/99999/position')
        .expect(404)

      expect(res.body.message).toContain('99999')
    })

    it('returns 400 for invalid time format', async () => {
      await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/position?time=not-a-date`)
        .expect(400)
    })
  })

  describe('GET /satellites/:noradId/orbit', () => {
    it('returns exactly 100 orbit points for ISS', async () => {
      const res = await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/orbit`)
        .expect(200)

      expect(res.body.noradId).toBe(ISS_NORAD)
      expect(res.body.points).toHaveLength(100)
    })

    it('each orbit point has timestamp, position, and velocity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/orbit`)
        .expect(200)

      const point = res.body.points[0]
      expect(point.timestamp).toBeDefined()
      expect(typeof point.position.x).toBe('number')
      expect(typeof point.position.y).toBe('number')
      expect(typeof point.position.z).toBe('number')
      expect(typeof point.velocity.x).toBe('number')
    })

    it('orbit points span approximately 90 minutes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/satellites/${ISS_NORAD}/orbit`)
        .expect(200)

      const first = new Date(res.body.points[0].timestamp).getTime()
      const last = new Date(res.body.points[99].timestamp).getTime()
      const spanMinutes = (last - first) / 1000 / 60

      expect(spanMinutes).toBeGreaterThan(88)
      expect(spanMinutes).toBeLessThan(91)
    })

    it('returns 404 for unknown NORAD ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/satellites/99999/orbit')
        .expect(404)

      expect(res.body.message).toContain('99999')
    })
  })
})
