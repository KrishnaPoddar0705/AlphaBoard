/**
 * One illustrative desk behind the home page's Matrix, Thinking Board and Institutional
 * Memory, so a note published in one appears in the others. Companies, analysts and
 * brokers are fictional on purpose: views on real listed names would read as a research
 * recommendation. Event kinds and connectors mirror the app.
 */

export type EventType = 'Concall' | '1:1' | 'Plant visit' | 'Broker report' | 'Annual report' | 'AGM';

export interface DeskEvent {
  id: string;
  ticker: string;
  company: string;
  analyst: string;
  type: EventType;
  title: string;
  excerpt: string;
  date: string;
  /** Sort key: higher is newer. */
  order: number;
  /** Scheduled, not yet happened: the Matrix shows it as Next. */
  next?: boolean;
  /** Has files attached, so it also appears under Source documents. */
  file?: boolean;
}

export const TEAMS: { name: string; analysts: { name: string; role: string }[] }[] = [
  { name: 'Autos & capital goods', analysts: [{ name: 'S. Mehta', role: 'Analyst' }] },
  { name: 'Financials & pharma', analysts: [{ name: 'R. Iyer', role: 'Analyst' }] },
  { name: 'Consumer & materials', analysts: [{ name: 'A. Shah', role: 'Analyst' }, { name: 'P. Nair', role: 'Analyst' }] },
  { name: 'Electronics & power', analysts: [{ name: 'K. Rao', role: 'Senior analyst' }] },
];

export const COMPANIES: { ticker: string; company: string; sector: string }[] = [
  { ticker: 'DECCANAUTO', company: 'Deccan Auto Components', sector: 'Autos' },
  { ticker: 'NARMADAFIN', company: 'Narmada Finance', sector: 'Financials' },
  { ticker: 'SAHYADRIEL', company: 'Sahyadri Electronics', sector: 'Electronics' },
  { ticker: 'ARAVALLIPH', company: 'Aravalli Pharma', sector: 'Pharma' },
  { ticker: 'KONKANCAB', company: 'Konkan Cables', sector: 'Capital goods' },
  { ticker: 'VINDHYACEM', company: 'Vindhya Cement', sector: 'Materials' },
  { ticker: 'MALABARPOLY', company: 'Malabar Polymers', sector: 'Chemicals' },
];

const co = (ticker: string) => COMPANIES.find((c) => c.ticker === ticker)!.company;
const ev = (id: string, ticker: string, analyst: string, type: EventType, title: string, date: string, order: number, excerpt: string, extra: Partial<DeskEvent> = {}): DeskEvent =>
  ({ id, ticker, company: co(ticker), analyst, type, title, date, order, excerpt, ...extra });

export const EVENTS: DeskEvent[] = [
  ev('d1', 'DECCANAUTO', 'S. Mehta', 'Plant visit', 'Chakan, second line', '14 Oct', 95, 'Second line running at 60%. Export orders are real, but the ramp is two quarters away.', { file: true }),
  ev('d2', 'DECCANAUTO', 'S. Mehta', 'Broker report', 'Harbour Securities update', '22 Sep', 88, 'Street raises FY27 export estimate; capacity math unchanged from our July model.', { file: true }),
  ev('d3', 'DECCANAUTO', 'S. Mehta', 'Concall', 'Q1 FY27', '6 Aug', 80, 'Export share of sales guided to 22% by FY28, from 16% today.', { file: true }),
  ev('d4', 'DECCANAUTO', 'S. Mehta', '1:1', 'CFO, Pune', '19 Jun', 70, 'Second line capex fully funded from internal accruals.'),
  ev('d5', 'DECCANAUTO', 'S. Mehta', 'Annual report', 'FY26', '18 Jul', 78, 'Segment note shows exports at 16% of FY26 sales, up from 13%.', { file: true }),
  ev('d6', 'DECCANAUTO', 'S. Mehta', '1:1', 'Promoter, Mumbai', '12 Nov', 101, 'Scheduled ahead of the plant ramp review.', { next: true }),

  ev('n1', 'NARMADAFIN', 'R. Iyer', 'Concall', 'Q2 FY27', '28 Oct', 99, 'Credit cost guide cut to 1.6%; collection efficiency back above 98%.', { file: true }),
  ev('n2', 'NARMADAFIN', 'R. Iyer', 'Broker report', 'Marine Lines results review', '28 Oct', 98, 'Raises FY27 AUM growth to 21% on the same asset quality read.', { file: true }),
  ev('n3', 'NARMADAFIN', 'R. Iyer', 'Concall', 'Q1 FY27', '30 Jul', 79, 'Stage 3 stable; management holding branch additions at 40 a quarter.', { file: true }),
  ev('n4', 'NARMADAFIN', 'R. Iyer', 'AGM', 'FY26', '24 Jul', 77, 'Chair reiterated no equity raise before FY28.'),

  ev('s1', 'SAHYADRIEL', 'K. Rao', '1:1', 'CFO, Mumbai office', '28 Oct', 97, 'Margin guide held at 4.1% despite the mobile mix. View upgraded and pushed to the PM.', { file: true }),
  ev('s2', 'SAHYADRIEL', 'K. Rao', 'Concall', 'Q1 FY27', '1 Aug', 81, 'Mobile mix up to 58%; wearables line ships in the second half.', { file: true }),
  ev('s3', 'SAHYADRIEL', 'K. Rao', 'Plant visit', 'Noida, SMT lines', '11 Sep', 86, 'Line utilisation near 80%; second shift added in August.'),

  ev('a1', 'ARAVALLIPH', 'R. Iyer', 'Annual report', 'FY26 read-through', '28 Oct', 96, 'Related-party sales up 40%; contingent liabilities doubled. Flagged to the risk desk.', { file: true }),
  ev('a2', 'ARAVALLIPH', 'R. Iyer', 'Concall', 'Q1 FY27', '8 Aug', 82, 'US price erosion in mid single digits; two ANDA approvals delayed.', { file: true }),

  ev('k1', 'KONKANCAB', 'S. Mehta', 'Concall', 'Q2 FY27', '27 Oct', 94, 'Order book at 2.3x sales; management confident on working capital.', { file: true }),
  ev('k2', 'KONKANCAB', 'S. Mehta', 'Plant visit', 'Vapi, HV line', '2 Sep', 85, 'New extrusion line commissioned a month ahead of plan.'),

  ev('v1', 'VINDHYACEM', 'P. Nair', 'AGM', 'FY26', '10 Jun', 68, 'Promoter ruled out new capex until net debt falls below 1x EBITDA.'),

  ev('m1', 'MALABARPOLY', 'A. Shah', 'Broker report', 'Harbour Securities initiation', '26 Oct', 93, 'Street is late: our model had the capacity math in July.', { file: true }),
  ev('m2', 'MALABARPOLY', 'A. Shah', '1:1', 'MD, Kochi', '17 Sep', 87, 'Spreads recovering; turnaround at Kochi completed on schedule.'),
];

/** The note the visitor publishes from the Thinking Board. */
export const NOTE = {
  ticker: 'DECCANAUTO',
  company: 'Deccan Auto Components',
  analyst: 'S. Mehta',
  type: 'Concall' as EventType,
  title: 'Q2 FY27',
  date: '29 Oct',
  view: 'Export orders are real, but the second line is only at 64%. Wait for the ramp before we add.',
};

/** Everything the Thinking Board can pull. Sources and fallback order mirror the app. */
export interface Connector { id: string; label: string; source: string; fetched: string }

export const CONNECTORS: Connector[] = [
  { id: 'concall', label: 'Concall', source: 'Drishti', fetched: '29 Oct 2026' },
  { id: 'results', label: 'Quarterly results', source: 'Drishti', fetched: '29 Oct 2026' },
  { id: 'cashflow', label: 'Cash flow', source: 'Screener', fetched: '29 Oct 2026' },
  { id: 'events', label: 'Corporate events', source: 'Drishti', fetched: '29 Oct 2026' },
  { id: 'news', label: 'News', source: 'Drishti', fetched: '29 Oct 2026' },
  { id: 'income', label: 'Income statement', source: 'Screener', fetched: '29 Oct 2026' },
  { id: 'balance', label: 'Balance sheet', source: 'Screener', fetched: '29 Oct 2026' },
  { id: 'ratios', label: 'Ratios & history', source: 'Screener', fetched: '29 Oct 2026' },
  { id: 'holding', label: 'Shareholding', source: 'Screener', fetched: '29 Oct 2026' },
];

/** Figures are ₹ crore. Margins and growth are worked from the rows shown. */
export const BOARD_DATA = {
  concall: {
    positives: ['Exports grew 31% year on year to 19% of sales.', 'Second line utilisation reached 64%, from 60% at the plant visit.'],
    negatives: ['Steel costs took 40 bps off gross margin.', 'Full ramp now guided for Q4 FY27, a quarter later than in August.'],
  },
  results: { head: ['₹ crore', 'Q2 FY27', 'Q2 FY26', 'Change'], rows: [['Revenue', '1,284', '1,102', '+16.5%'], ['EBITDA', '186', '154', '+20.8%'], ['EBITDA margin', '14.5%', '14.0%', '+50 bps'], ['PAT', '102', '84', '+21.4%']] },
  cashflow: { years: ['FY23', 'FY24', 'FY25', 'FY26'], operating: [96, 118, 141, 163], free: [31, 44, 58, 72] },
  events: ['Board approved ₹180 crore for the second line, 12 Sep', 'Interim dividend of ₹4 a share, 28 Oct', 'Investor day at Chakan, 12 Dec'],
  news: ['Deccan Auto wins a second European OEM programme', 'Auto component exports rise for a sixth straight quarter'],
  income: { head: ['₹ crore', 'FY24', 'FY25', 'FY26'], rows: [['Revenue', '3,610', '4,120', '4,690'], ['EBITDA', '470', '565', '660'], ['PAT', '240', '305', '362']] },
  balance: { head: ['₹ crore', 'FY24', 'FY25', 'FY26'], rows: [['Total assets', '3,120', '3,480', '3,910'], ['Total debt', '640', '590', '520']] },
  ratios: { head: ['', 'FY24', 'FY25', 'FY26'], rows: [['ROCE', '17.2%', '18.6%', '19.4%'], ['Debt to equity', '0.38', '0.31', '0.24']] },
  holding: { head: ['Holder', 'Sep 2026'], rows: [['Promoter', '58.2%'], ['DII', '16.8%'], ['FII', '11.4%'], ['Public', '13.6%']] },
};

export interface Source { kind: string; title: string; where: string; who: string; when: string; quote: string }
export interface Answer { keys: string[]; company: string; question: string; answer: string; sources: Source[] }

/** {n} in an answer is a citation marker for sources[n - 1]. */
export const ANSWERS: Answer[] = [
  {
    keys: ['deccan', 'auto', 'export', 'chakan'],
    company: 'Deccan Auto Components',
    question: 'What did Deccan Auto say about exports?',
    answer: 'Export orders are real{1}, and management guides exports to 22% of sales by FY28{2}. The second line was at 60% in October{1}, so the desk is waiting for it to fill before it adds{1}.',
    sources: [
      { kind: 'Internal report', title: 'Chakan plant note', where: 'p. 2', who: 'uploaded', when: '14 Oct 2026', quote: 'Second line running at 60%. Export orders are real, but the ramp is two quarters away.' },
      { kind: 'Transcript', title: 'Q1 FY27 concall', where: 'p. 7', who: 'uploaded', when: '6 Aug 2026', quote: 'We expect exports to reach 22% of sales by FY28, from 16% today.' },
      { kind: 'Broker report', title: 'Harbour Securities update', where: 'p. 3', who: 'uploaded', when: '22 Sep 2026', quote: 'We raise our FY27 export estimate on the second OEM programme.' },
      { kind: 'Annual report', title: 'FY26, segment note', where: 'p. 54', who: 'uploaded', when: '18 Jul 2026', quote: 'Exports were 16% of revenue in FY26 (FY25: 13%).' },
    ],
  },
  {
    keys: ['narmada', 'finance', 'credit', 'collection', 'nbfc'],
    company: 'Narmada Finance',
    question: 'What did the Narmada Finance concall change?',
    answer: 'Management cut the credit cost guide to 1.6%{1} and collection efficiency is back above 98%{2}. The desk logged the thesis as strengthened{1}.',
    sources: [
      { kind: 'Internal report', title: 'Q2 FY27 concall note', where: 'p. 1', who: 'uploaded', when: '28 Oct 2026', quote: 'Credit cost guide cut to 1.6%. Thesis strengthened.' },
      { kind: 'Results filing', title: 'Q2 FY27, asset quality', where: 'p. 6', who: 'uploaded', when: '27 Oct 2026', quote: 'Collection efficiency for the quarter stood at 98.2%.' },
      { kind: 'Broker report', title: 'Marine Lines results review', where: 'p. 4', who: 'uploaded', when: '28 Oct 2026', quote: 'We raise FY27 AUM growth to 21%.' },
    ],
  },
  {
    keys: ['aravalli', 'pharma', 'related', 'risk', 'liabilit', 'negative'],
    company: 'Aravalli Pharma',
    question: 'Why are we negative on Aravalli Pharma?',
    answer: 'Related-party sales rose 40%{1} and contingent liabilities doubled in FY26{1}. R. Iyer flagged it to the risk desk the same morning{2}.',
    sources: [
      { kind: 'Annual report', title: 'FY26', where: 'pp. 112, 148', who: 'uploaded', when: '28 Oct 2026', quote: 'Related-party sales up 40%; contingent liabilities doubled.' },
      { kind: 'Internal report', title: 'Risk memo', where: 'p. 1', who: 'uploaded', when: '28 Oct 2026', quote: 'Flagged to the risk desk pending a call with the auditor.' },
    ],
  },
  {
    keys: ['sahyadri', 'electronics', 'margin', 'cfo'],
    company: 'Sahyadri Electronics',
    question: 'What is the margin guide at Sahyadri Electronics?',
    answer: 'The CFO held the margin guide at 4.1%{1} despite a heavier mobile mix{2}. K. Rao upgraded the view and pushed it to the PM{1}.',
    sources: [
      { kind: 'Internal report', title: 'CFO meeting note', where: 'p. 1', who: 'uploaded', when: '28 Oct 2026', quote: 'Margin guide held at 4.1% despite the mobile mix. View upgraded and pushed to the PM.' },
      { kind: 'Transcript', title: 'Q1 FY27 concall', where: 'p. 9', who: 'uploaded', when: '1 Aug 2026', quote: 'Mobile is now 58% of our mix.' },
    ],
  },
];

export interface Report { title: string; sector: string; broker: string; month: string }

export const REPORTS: Report[] = [
  { title: 'Deccan Auto, plant note', sector: 'Automotive', broker: 'Internal', month: 'Oct 2026' },
  { title: 'Deccan Auto, Q1 FY27 transcript', sector: 'Automotive', broker: 'Filing', month: 'Aug 2026' },
  { title: 'Auto ancillaries, export outlook', sector: 'Automotive', broker: 'Harbour Securities', month: 'Sep 2026' },
  { title: 'Narmada Finance, results review', sector: 'Financials', broker: 'Marine Lines', month: 'Oct 2026' },
  { title: 'Housing finance, sector note', sector: 'Financials', broker: 'Marine Lines', month: 'Sep 2026' },
  { title: 'Aravalli Pharma, FY26 annual report', sector: 'Pharma', broker: 'Filing', month: 'Oct 2026' },
  { title: 'Malabar Polymers, initiation', sector: 'Chemicals', broker: 'Harbour Securities', month: 'Oct 2026' },
  { title: 'Graphite electrodes, sector note', sector: 'Metals & mining', broker: 'Marine Lines', month: 'Aug 2026' },
];

export interface Passage { report: string; page: number; text: string }

export const PASSAGES: Passage[] = [
  { report: 'Deccan Auto, Q1 FY27 transcript', page: 7, text: 'We expect exports to reach 22% of sales by FY28, from 16% today.' },
  { report: 'Auto ancillaries, export outlook', page: 12, text: 'Export share across our coverage rose to 19% in H1 FY27.' },
  { report: 'Narmada Finance, results review', page: 4, text: 'We raise FY27 AUM growth to 21% on stable credit cost.' },
  { report: 'Housing finance, sector note', page: 9, text: 'Credit cost across the sector held near 1.2% through the quarter.' },
  { report: 'Aravalli Pharma, FY26 annual report', page: 112, text: 'Sales to related parties increased 40% over the previous year.' },
  { report: 'Aravalli Pharma, FY26 annual report', page: 148, text: 'Contingent liabilities not provided for doubled during the year.' },
  { report: 'Malabar Polymers, initiation', page: 3, text: 'Capacity additions at Kochi lift volumes by a fifth in FY28.' },
  { report: 'Graphite electrodes, sector note', page: 5, text: 'Export realisations recovered as Chinese capacity was retired.' },
];
