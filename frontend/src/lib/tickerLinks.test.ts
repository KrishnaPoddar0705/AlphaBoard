import { describe, it, expect } from 'vitest'
import { linkifyTickers, isScreenerLink } from './tickerLinks'

describe('linkifyTickers', () => {
  it('links an NSE ticker to its screener.in page', () => {
    expect(linkifyTickers('Hindustan Aeronautics Ltd (NSE: HAL) won orders.')).toBe(
      'Hindustan Aeronautics Ltd (NSE: [HAL](https://www.screener.in/company/HAL/)) won orders.',
    )
  })

  it('links BSE codes and symbols containing & or -', () => {
    expect(linkifyTickers('Reliance (BSE: 500325), Mahindra (NSE: M&M), Bajaj Auto (NSE: BAJAJ-AUTO)')).toBe(
      'Reliance (BSE: [500325](https://www.screener.in/company/500325/)), ' +
      'Mahindra (NSE: [M&M](https://www.screener.in/company/M%26M/)), ' +
      'Bajaj Auto (NSE: [BAJAJ-AUTO](https://www.screener.in/company/BAJAJ-AUTO/))',
    )
  })

  it('leaves foreign tickers, lowercase text and plain parentheses alone', () => {
    const text = 'JPMorgan (NYSE: JPM) said growth (NSE: not a ticker) is (approximately) 15%.'
    expect(linkifyTickers(text)).toBe(text)
  })
})

describe('isScreenerLink', () => {
  it('recognises only screener.in company links', () => {
    expect(isScreenerLink('https://www.screener.in/company/HAL/')).toBe(true)
    expect(isScreenerLink('https://example.com/company/HAL/')).toBe(false)
    expect(isScreenerLink(undefined)).toBe(false)
  })
})
