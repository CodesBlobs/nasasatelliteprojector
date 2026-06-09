import { Test, TestingModule } from '@nestjs/testing'
import { TleParserService } from './tle-parser.service'
import { InvalidTleException } from '../exceptions/invalid-tle.exception'

describe('TleParserService', () => {
  let service: TleParserService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TleParserService],
    }).compile()

    service = module.get<TleParserService>(TleParserService)
  })

  describe('parse', () => {
    it('should extract NORAD ID from ISS TLE', () => {
      const line1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      const result = service.parse(line1, line2)

      expect(result.noradId).toBe(25544)
    })

    it('should extract epoch year correctly', () => {
      const line1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      const result = service.parse(line1, line2)

      expect(result.epochYear).toBe(2023)
    })

    it('should extract epoch day of year', () => {
      const line1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      const result = service.parse(line1, line2)

      expect(result.epochDayOfYear).toBe(1)
    })

    it('should handle 20th century year correctly', () => {
      const line1 = '1 25544U 98067A   98001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      const result = service.parse(line1, line2)

      expect(result.epochYear).toBe(1998)
    })

    it('should reject TLE with wrong line1 length', () => {
      const line1 = '1 25544U 98067A   23001'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })

    it('should reject TLE with wrong line2 length', () => {
      const line1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })

    it('should reject TLE without line1 prefix', () => {
      const line1 = '0 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })

    it('should reject TLE without line2 prefix', () => {
      const line1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '1 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })

    it('should reject invalid NORAD ID', () => {
      const line1 = '1 0000ZU 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })

    it('should reject invalid epoch day', () => {
      const line1 = '1 25544U 98067A   23400.00000000  .00016717  00000-0  29770-3 0  9005'
      const line2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

      expect(() => service.parse(line1, line2)).toThrow(InvalidTleException)
    })
  })
})
