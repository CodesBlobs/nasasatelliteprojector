import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { TleModule } from './tle.module'
import { PrismaService } from '../../common/prisma/prisma.service'
import * as request from 'supertest'

describe('TLE Controller (Integration)', () => {
  let app: INestApplication
  let prisma: PrismaService

  const validTle = {
    name: 'ISS (ZARYA)',
    line1: '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005',
    line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645',
    country: 'Russia',
    operator: 'RKA',
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TleModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    )
    await app.init()

    prisma = moduleFixture.get<PrismaService>(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await prisma.tLE.deleteMany({})
    await prisma.satellite.deleteMany({})
  })

  describe('POST /tle/import', () => {
    it('should import a new TLE and create satellite', async () => {
      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send(validTle)
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name', 'ISS (ZARYA)')
      expect(response.body).toHaveProperty('noradId', 25544)
      expect(response.body).toHaveProperty('created', true)
      expect(response.body).toHaveProperty('epoch')
    })

    it('should update TLE for existing satellite', async () => {
      await request(app.getHttpServer())
        .post('/tle/import')
        .send(validTle)
        .expect(201)

      const updatedLine1 =
        '1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006'

      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send({
          ...validTle,
          line1: updatedLine1,
        })
        .expect(201)

      expect(response.body.created).toBe(false)

      const satellites = await prisma.satellite.findMany()
      expect(satellites).toHaveLength(1)
    })

    it('should reject invalid TLE with bad length', async () => {
      const invalidTle = {
        ...validTle,
        line1: '1 25544U 98067A   23001',
      }

      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send(invalidTle)
        .expect(400)

      expect(response.body.message).toContain('Invalid TLE')
    })

    it('should reject request with missing name', async () => {
      const { name, ...withoutName } = validTle

      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send(withoutName)
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should reject request with missing line1', async () => {
      const { line1, ...withoutLine1 } = validTle

      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send(withoutLine1)
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should reject request with missing line2', async () => {
      const { line2, ...withoutLine2 } = validTle

      const response = await request(app.getHttpServer())
        .post('/tle/import')
        .send(withoutLine2)
        .expect(400)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /tle/:noradId', () => {
    it('should return satellite and latest TLE', async () => {
      await request(app.getHttpServer())
        .post('/tle/import')
        .send(validTle)
        .expect(201)

      const response = await request(app.getHttpServer())
        .get('/tle/25544')
        .expect(200)

      expect(response.body).toHaveProperty('satellite')
      expect(response.body).toHaveProperty('tle')
      expect(response.body.satellite.noradId).toBe(25544)
      expect(response.body.tle.line1).toBe(validTle.line1)
    })

    it('should return 404 for non-existent satellite', async () => {
      const response = await request(app.getHttpServer())
        .get('/tle/99999')
        .expect(404)

      expect(response.body.message).toContain('not found')
    })
  })

  describe('GET /tle/:noradId/history', () => {
    it('should return satellite and TLE history', async () => {
      const tle1 = validTle
      const tle2 = {
        ...validTle,
        line1: '1 25544U 98067A   23002.00000000  .00016717  00000-0  29770-3 0  9006',
      }

      await request(app.getHttpServer())
        .post('/tle/import')
        .send(tle1)
        .expect(201)

      await request(app.getHttpServer())
        .post('/tle/import')
        .send(tle2)
        .expect(201)

      const response = await request(app.getHttpServer())
        .get('/tle/25544/history')
        .expect(200)

      expect(response.body).toHaveProperty('satellite')
      expect(response.body).toHaveProperty('tles')
      expect(response.body.tles).toHaveLength(2)
    })

    it('should respect limit parameter', async () => {
      const baseTle = {
        ...validTle,
      }

      for (let i = 0; i < 5; i++) {
        const line1 = `1 25544U 98067A   23${String(i + 1).padStart(2, '0')}.00000000  .00016717  00000-0  29770-3 0  900${i}`
        await request(app.getHttpServer())
          .post('/tle/import')
          .send({
            ...baseTle,
            line1,
          })
      }

      const response = await request(app.getHttpServer())
        .get('/tle/25544/history?limit=3')
        .expect(200)

      expect(response.body.tles).toHaveLength(3)
    })
  })

  describe('GET /tle', () => {
    it('should list latest TLEs', async () => {
      const tle1 = validTle
      const tle2 = {
        name: 'SOYUZ MS-23',
        line1: '1 51734U 21090A   23001.00000000  .00001234  00000-0  12345-3 0  9999',
        line2: '2 51734  51.6480 110.4833 0000901  95.0000 265.1000 15.54500000100000',
      }

      await request(app.getHttpServer())
        .post('/tle/import')
        .send(tle1)
        .expect(201)

      await request(app.getHttpServer())
        .post('/tle/import')
        .send(tle2)
        .expect(201)

      const response = await request(app.getHttpServer())
        .get('/tle')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(2)
      expect(response.body[0]).toHaveProperty('satellite')
      expect(response.body[0]).toHaveProperty('tle')
    })
  })
})
