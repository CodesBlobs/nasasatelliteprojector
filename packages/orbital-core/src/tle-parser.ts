import { ParsedTLE } from '@orbital/shared'

export function parseTLE(line1: string, line2: string): ParsedTLE {
  const tle1 = line1.trim()
  const tle2 = line2.trim()

  if (tle1.length < 69 || tle2.length < 69) {
    throw new Error('Invalid TLE format')
  }

  const noradId = parseInt(tle1.substring(2, 7).trim(), 10)
  const satelliteName = tle1.substring(10, 40).trim()
  const epochYear = parseInt(tle1.substring(18, 20), 10)
  const epochDayOfYear = parseFloat(tle1.substring(20, 32))

  return {
    noradId,
    satelliteName,
    epochYear: epochYear < 70 ? 2000 + epochYear : 1900 + epochYear,
    epochDayOfYear,
    line1: tle1,
    line2: tle2,
  }
}

export function calculateEpochDate(year: number, dayOfYear: number): Date {
  const isLeapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]

  let month = 0
  let day = dayOfYear
  for (let i = 0; i < daysInMonth.length; i++) {
    if (day <= daysInMonth[i]) {
      month = i
      break
    }
    day -= daysInMonth[i]
  }

  return new Date(year, month, day)
}
