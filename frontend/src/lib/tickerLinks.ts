// "(NSE: HAL)" in an answer becomes "(NSE: [HAL](https://www.screener.in/company/HAL/))".
// The answer prompt (companyTickerRules in supabase/functions/_shared/gemini-client.ts)
// makes the model write company tickers in exactly this shape.

const SCREENER_COMPANY = 'https://www.screener.in/company/';
const TICKER = /\((NSE|BSE):\s*([A-Z0-9][A-Z0-9&-]{0,19})\)/g;

export const isScreenerLink = (href?: string): boolean => !!href && href.startsWith(SCREENER_COMPANY);

export function screenerUrl(symbol: string): string {
  return `${SCREENER_COMPANY}${encodeURIComponent(symbol)}/`;
}

/** Turn "(NSE: SYMBOL)" and "(BSE: CODE)" mentions into screener.in links. Other text is untouched. */
export function linkifyTickers(markdown: string): string {
  return markdown.replace(TICKER, (_m, exchange: string, symbol: string) =>
    `(${exchange}: [${symbol}](${screenerUrl(symbol)}))`,
  );
}
