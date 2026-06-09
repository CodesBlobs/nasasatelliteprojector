import { Injectable } from '@nestjs/common'
import { InvalidTleException } from '../exceptions/invalid-tle.exception'

export interface ParsedTleData {
  noradId: number
  epochYear: number
  epochDayOfYear: number
}

@Injectable()
export class TleParserService {
  parse(line1: string, line2: string): ParsedTleData {
    this.validateFormat(line1, line2)

    const noradId = this.extractNoradId(line1)
    const epochYear = this.extractEpochYear(line1)
    const epochDayOfYear = this.extractEpochDay(line1)

    return {
      noradId,
      epochYear,
      epochDayOfYear,
    }
  }

  private validateFormat(line1: string, line2: string): void {
    if (!line1 || typeof line1 !== 'string') {
      throw new InvalidTleException('Line 1 must be a non-empty string')
    }

    if (!line2 || typeof line2 !== 'string') {
      throw new InvalidTleException('Line 2 must be a non-empty string')
    }

    if (line1.length !== 69) {
      throw new InvalidTleException(
        `Line 1 must be exactly 69 characters, got ${line1.length}`
      )
    }

    if (line2.length !== 69) {
      throw new InvalidTleException(
        `Line 2 must be exactly 69 characters, got ${line2.length}`
      )
    }

    if (!line1.startsWith('1 ')) {
      throw new InvalidTleException('Line 1 must start with "1 "')
    }

    if (!line2.startsWith('2 ')) {
      throw new InvalidTleException('Line 2 must start with "2 "')
    }
  }

  private extractNoradId(line1: string): number {
    const noradStr = line1.substring(2, 7).trim()
    const noradId = parseInt(noradStr, 10)

    if (isNaN(noradId) || noradId <= 0) {
      throw new InvalidTleException('Invalid NORAD catalog number')
    }

    return noradId
  }

  private extractEpochYear(line1: string): number {
    const yearStr = line1.substring(18, 20)
    const year = parseInt(yearStr, 10)

    if (isNaN(year)) {
      throw new InvalidTleException('Invalid epoch year')
    }

    return year < 70 ? 2000 + year : 1900 + year
  }

  private extractEpochDay(line1: string): number {
    const dayStr = line1.substring(20, 32)
    const day = parseFloat(dayStr)

    if (isNaN(day) || day < 1 || day > 366) {
      throw new InvalidTleException('Invalid epoch day of year')
    }

    return day
  }

  epochToDate(epochYear: number, epochDayOfYear: number): Date {
    const isLeapYear =
      epochYear % 400 === 0 || (epochYear % 4 === 0 && epochYear % 100 !== 0)
    const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    let month = 0
    let day = Math.floor(epochDayOfYear)

    for (let i = 0; i < daysInMonth.length; i++) {
      if (day <= daysInMonth[i]) {
        month = i
        break
      }
      day -= daysInMonth[i]
    }

    const fracDay = epochDayOfYear - Math.floor(epochDayOfYear)
    const date = new Date(epochYear, month, day)
    date.setTime(date.getTime() + fracDay * 24 * 3600 * 1000)
    return date
  }
}
