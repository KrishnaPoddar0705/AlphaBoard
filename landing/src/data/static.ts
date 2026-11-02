/** Copy for /security and /india, shared with the markdown mirrors. */

export const SECURITY_POINTS = [
  { title: 'Isolated per firm', body: 'Every organisation’s data is separated by row-level security in the database. One firm cannot query another’s rows, by design rather than by convention.' },
  { title: 'Roles inside the firm', body: 'Admins, portfolio managers and analysts see and do different things. Outside advisors can be invited with narrower access.' },
  { title: 'An attributed record', body: 'Every research entry carries who logged it and when, its rationale and its attachments: the trail a compliance review asks for.' },
  { title: 'Sign-in you can manage', body: 'Authentication runs through Clerk, with organisation membership controlled by your admins.' },
  { title: 'Analytics that mask inputs', body: 'Product analytics record clicks and page views, and form inputs are masked in session replays.' },
];

export const SECURITY_FAQ = [
  { q: 'Is AlphaBoard SOC 2 or ISO 27001 certified?', a: 'Not yet. We will publish certifications here when we have them, not before. Ask us for our current security questionnaire answers.' },
  { q: 'Can our data be hosted in India?', a: 'India-region hosting is on the roadmap for firms that need it. Ask us for the current status before you sign.' },
  { q: 'Does AlphaBoard help with SEBI record-keeping?', a: 'It keeps a timestamped, attributed record of research and decisions, which supports the record-keeping that the SEBI Research Analyst and PMS regulations require. Your compliance officer remains responsible for compliance.' },
  { q: 'Which AI providers process our data?', a: 'AI features call third-party model providers, and documents in Institutional Memory are processed by Google’s Gemini models. We will share the current list and their data terms on request.' },
];

export const INDIA_POINTS = [
  { title: 'The Indian research calendar', body: 'Results season, concalls, AGMs, NDRs, plant visits and management 1:1s are first-class events, booked ahead and logged when they happen.' },
  { title: 'Rupees, crores, IST', body: 'Prices in rupees, sizes in crore, timestamps in IST, tickers as NSE and BSE write them.' },
  { title: 'WhatsApp, because that is where it happens', body: 'Indian desks share ideas on WhatsApp. The AlphaBoard assistant brings prices, alerts and recommendations into that chat instead of fighting it.' },
  { title: 'Disclosures that matter here', body: 'Promoter pledges, SAST and insider filings, bulk and block deals, shareholding patterns: the signals Indian analysts check, on the connector roadmap first.' },
  { title: 'SEBI-ready records', body: 'A timestamped, attributed trail of research and decisions, to support the record-keeping expected of research analysts and portfolio managers.' },
];
