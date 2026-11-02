import type { Faq } from './faq';
import type { ImageName } from '../lib/images';

/** An archival photograph with its caption, for the older page mastheads. */
export interface PageImage { name: ImageName; alt: string; caption: string }

/** Which interface fragment a page shows as its proof. */
export type Visual = 'matrix' | 'memory' | 'needs' | 'board' | 'whatsapp';

export interface Point { title: string; body: string }
export interface LandingPage {
  slug: string;
  /** Short name for navigation and breadcrumbs. */
  name: string;
  /** The h1: two lines at most. */
  title: string;
  seoTitle: string;
  description: string;
  lede: string;
  visual: Visual;
  /** Where the research goes today, in this reader's own words. */
  painsTitle: string;
  pains: Point[];
  /** How the team works, step by step, with AlphaBoard in it. */
  processTitle: string;
  process: Point[];
  pointsTitle: string;
  points: Point[];
  proofTitle: string;
  proof: string;
  faq: Faq[];
  close: string;
}

export const PRODUCTS: LandingPage[] = [
  {
    slug: 'matrix',
    name: 'Matrix',
    title: 'Matrix: one record per company',
    seoTitle: 'Matrix: the research process tracker and source of truth for every company you cover',
    description: 'The Matrix tracks every piece of research work against every company you cover: concalls, AGMs, broker reports and management 1:1s, each with your analysts’ internal notes and comments.',
    lede: 'Every company you cover gets one record. Concalls, AGMs, broker reports and management 1:1s land in it with the analyst’s notes and the PM’s comments, so the record is the place the desk goes first.',
    visual: 'matrix',
    painsTitle: 'Where a company’s research lives today',
    pains: [
      { title: 'In six places at once', body: 'The concall note is in a notebook, the broker PDF in an inbox, the CFO meeting in a WhatsApp thread and the model on someone’s laptop.' },
      { title: 'In one analyst’s head', body: 'Ask what the desk last heard from management and the answer depends on who is in the office.' },
      { title: 'Nowhere, for the names nobody touched', body: 'A stock can go two quarters without a meeting and nobody notices until the results surprise.' },
    ],
    processTitle: 'How a desk runs on the Matrix',
    process: [
      { title: 'Cover', body: 'Load the coverage universe by sector and analyst. Every name gets a row.' },
      { title: 'Log', body: 'Each concall, AGM, broker report, plant visit or 1:1 is logged to its row in about two minutes, with notes and files.' },
      { title: 'Discuss', body: 'PMs and colleagues comment on the entry itself, so the conversation stays with the evidence.' },
      { title: 'Review', body: 'Blank cells show research nobody did; the by-analyst lens shows who did what this quarter.' },
    ],
    pointsTitle: 'What the Matrix gives the desk',
    points: [
      { title: 'A process tracker', body: 'Stocks down the side, kinds of research work across the top. A filled cell is work done; a blank one is a gap you can see.' },
      { title: 'A source of truth', body: 'Open any cell for its timeline: the concall notes, the broker report, the 1:1 write-up, the internal comments, in order.' },
      { title: 'Internal notes beside external research', body: 'Your analyst’s read of the concall sits next to the transcript and the sell-side note, so the desk sees what it thinks as well as what was said.' },
      { title: 'The same grid by analyst', body: 'Switch the lens to see each analyst’s coverage and activity, which is how PMs and fund managers check the work without asking.' },
      { title: 'Coverage that cannot go quiet', body: 'Needs You lists names with no meeting, concall or AGM in months, and ideas waiting on a PM decision.' },
    ],
    proofTitle: 'Built around the research calendar',
    proof: 'Results season, concalls, AGMs, NDRs, plant visits and management meetings are first-class events, booked ahead on the calendar and logged when they happen.',
    faq: [
      { q: 'Which kinds of research work does the Matrix track?', a: 'One-on-ones, plant visits, conferences, group meetings, calls, concalls, annual reports, broker reports and AGMs. Each is a column, and each entry carries notes, attachments and comments.' },
      { q: 'Can a PM see one analyst’s work only?', a: 'Yes. The by-analyst lens and the Command Center filter to a team or a person, so a PM can review a week of one analyst’s work in a few minutes.' },
      { q: 'What happens when an analyst leaves?', a: 'Their entries, notes and files stay on the company records they belong to. The next analyst inherits the full history of every name.' },
    ],
    close: 'Bring your coverage list and we will load your Matrix before the call.',
  },
  {
    slug: 'company-brain',
    name: 'Institutional Memory',
    title: 'Ask what the firm knows',
    seoTitle: 'Institutional Memory: ask across every filing, broker report and research note your firm holds',
    description: 'Institutional Memory keeps the reports your firm uploads: results and annual reports, sell-side stock and sector reports, transcripts and internal notes. Ask the Brain across all of them and it answers with numbered sources you can open.',
    lede: 'Ask a question about a company in plain words. The Brain works out where the answer lives, reads across the reports your firm has uploaded, and answers with numbered sources you can open.',
    visual: 'memory',
    painsTitle: 'What finding an answer costs today',
    pains: [
      { title: 'Forty PDFs and a search box', body: 'Three years of annual reports, a dozen broker initiations and every concall: the answer is in there, somewhere past page 80.' },
      { title: 'Knowledge that leaves', body: 'What the desk learned from the CFO two years ago left with the analyst who took the meeting.' },
      { title: 'Summaries you cannot check', body: 'A generic AI answer without a page reference is a guess your PM cannot use.' },
    ],
    processTitle: 'How the Brain answers',
    process: [
      { title: 'Plan', body: 'It breaks the question into what it needs: which company, which period, which kinds of source.' },
      { title: 'Retrieve', body: 'It searches the filings, annual reports, broker and sector reports, transcripts and internal notes you have uploaded for the passages that matter.' },
      { title: 'Read', body: 'It reads those passages together and reconciles what management said with what the sell side and your analysts wrote.' },
      { title: 'Cite', body: 'It answers in plain words with numbered sources. Open one to read the quote behind the claim, usually with its page.' },
    ],
    pointsTitle: 'What goes into the brain',
    points: [
      { title: 'Company filings', body: 'Quarterly results, annual reports and disclosures. Upload them today; automatic feeds from NSE and BSE are on the connector roadmap.' },
      { title: 'Sell-side research', body: 'Stock initiations, updates and sector reports from brokers and research firms, uploaded or forwarded as PDFs.' },
      { title: 'Your desk’s own knowledge', body: 'Upload your concall notes, meeting write-ups and IC memos as PDFs, and the Brain reads them with everything else.' },
      { title: 'Answers you can audit', body: 'Every answer lists the sources it drew on. Open one to read the quote behind the claim.' },
      { title: 'Isolated from every other firm', body: 'Each firm’s documents are isolated from every other firm’s by row-level security.' },
    ],
    proofTitle: 'Questions it is built for',
    proof: 'What did management say about exports in the last three concalls? Which brokers changed their view after the results? What did we write about related-party sales before we exited?',
    faq: [
      { q: 'Is this a chatbot over the internet?', a: 'No. The Brain answers from the documents your firm has added, and shows its sources. If the answer is not in them, it says so.' },
      { q: 'Which documents can it read?', a: 'Text-based PDFs such as annual reports, results filings, broker and sector reports and transcripts. Scanned documents without a text layer are not read yet. More sources arrive as connectors go live.' },
      { q: 'Which AI providers process our documents?', a: 'Documents are processed by Google’s Gemini models to answer questions. We share the current list of providers and their data terms on request, before you upload anything.' },
    ],
    close: 'Send us three documents you know well and ask the brain about them in the demo.',
  },
];

export const SOLUTIONS: LandingPage[] = [
  {
    slug: 'pms',
    name: 'PMS',
    title: 'For PMS research desks',
    seoTitle: 'Research platform for PMS desks: every analyst’s work and every stock’s research in one place',
    description: 'AlphaBoard gives Indian PMS houses one record per stock and a Command Center for the fund manager: every concall, management meeting and broker report, with the analyst’s notes, in one place.',
    lede: 'A PMS is judged on the quality of its ideas and the discipline behind them. AlphaBoard puts both on one screen: what every analyst researched this week, and the full record behind every stock in the book.',
    visual: 'board',
    painsTitle: 'What a PMS desk lives with',
    pains: [
      { title: 'Results season in six places', body: 'Forty concalls in two weeks, notes split across notebooks, email and WhatsApp, and no single view of what changed.' },
      { title: 'The fund manager asks around', body: 'To know what the desk did this week, the fund manager has to ask each analyst.' },
      { title: '“Why did we buy this?”', body: 'A client or compliance asks, and the reasoning is in an email thread from last March.' },
    ],
    processTitle: 'The PMS process, step by step',
    process: [
      { title: 'Coverage', body: 'The universe is split by sector and analyst in the Matrix; every name has a record.' },
      { title: 'Results season', body: 'Concalls are booked on the calendar and logged against the stock the same morning.' },
      { title: 'Model portfolio decisions', body: 'Analysts push ideas to the review queue; the fund manager comments, approves or parks them.' },
      { title: 'Clients and compliance', body: 'Export a thesis with its research trail for the client letter, and keep the dated record SEBI expects.' },
    ],
    pointsTitle: 'What changes on a PMS desk',
    points: [
      { title: 'One record per stock', body: 'Meetings, concalls, plant visits and broker notes land on the stock they belong to, with the analyst’s view of what changed.' },
      { title: 'A Command Center for the fund manager', body: 'Every analyst’s activity, every pending decision and every quiet name on one screen.' },
      { title: 'Answers in seconds', body: 'The Brain answers questions across your filings, broker reports and uploaded notes, and shows its sources.' },
      { title: 'A record that outlasts people', body: 'When an analyst moves on, the coverage history stays with the stock.' },
    ],
    proofTitle: 'Built for the PMS rhythm',
    proof: 'Results season, management meets, AGMs and NDRs are first-class events. Rupees in crore, Indian tickers and IST timestamps throughout.',
    faq: [
      { q: 'How long does it take a PMS team to start?', a: 'Load your coverage list, invite the desk, and analysts can log from the first day. Most of the value arrives in the first results season, when every concall lands in one place.' },
      { q: 'Can different strategies be kept apart?', a: 'Yes. Coverage is organised by sector and team, and the Matrix and Command Center filter to a team or an analyst.' },
      { q: 'Does it help with SEBI record-keeping?', a: 'Every research interaction is timestamped and attributed, with its rationale and attachments: the trail compliance teams need to show. It supports your compliance process; it does not replace your compliance officer.' },
    ],
    close: 'Bring your coverage list; we will load it before the call.',
  },
  {
    slug: 'aif',
    name: 'AIF',
    title: 'For AIF investment teams',
    seoTitle: 'Research platform for AIFs: IC memos, research trails and LP-ready records for Category II and III funds',
    description: 'AlphaBoard gives Category II and III AIFs one research record per position: the work behind every IC memo, long or short, ready for the investment committee and for LP due diligence.',
    lede: 'An AIF answers to an investment committee and to its LPs. AlphaBoard keeps the research behind every position, long or short, in one record, so the IC memo and the LP questionnaire start from the same evidence.',
    visual: 'memory',
    painsTitle: 'What an AIF team rebuilds every quarter',
    pains: [
      { title: 'IC memos from scratch', body: 'Each memo is reassembled from old emails, broker PDFs and a model nobody else can open.' },
      { title: 'LPs ask about process', body: 'Due diligence questionnaires ask how research is done and recorded. The honest answer is spread across inboxes.' },
      { title: 'Short books need a trail too', body: 'A short thesis rests on filings and forensic reading that are easy to lose once the position is closed.' },
    ],
    processTitle: 'The AIF process, step by step',
    process: [
      { title: 'Ideas', body: 'Analysts log meetings, filings and broker reports to the company record as the idea forms.' },
      { title: 'Investment committee', body: 'The IC memo links to the evidence behind it; the committee’s comments and decision are kept with it.' },
      { title: 'Monitoring', body: 'Every concall and disclosure after entry lands on the same record, and quiet names are flagged.' },
      { title: 'LP reporting', body: 'Show LPs a dated, attributed research process instead of describing one.' },
    ],
    pointsTitle: 'What changes for an AIF',
    points: [
      { title: 'One record per position', body: 'Long or short, listed or pre-IPO, the research behind every name stays together.' },
      { title: 'IC decisions on the record', body: 'Who proposed, who reviewed, what was decided and when, kept with the evidence.' },
      { title: 'Institutional Memory for the hard questions', body: 'Ask across annual reports, related-party notes and broker research, and open the sources behind the answer.' },
      { title: 'Separate strategies, one platform', body: 'Teams and roles keep strategies apart while the CIO sees across them.' },
    ],
    proofTitle: 'Ready for the questions LPs ask',
    proof: 'How is research recorded? Who signs off on a position? What did you know before you entered? AlphaBoard answers with the record itself. LP views of that record are on the roadmap.',
    faq: [
      { q: 'Does it work for Category III long-short funds?', a: 'Yes. Short theses are logged like long ones, against the same company record, with the same notes, files and review.' },
      { q: 'Can LPs log in?', a: 'Not yet. Today admins, portfolio managers and analysts have access. LP views of the research record are on the roadmap; tell us what your LPs ask for.' },
      { q: 'Can we keep two strategies separate?', a: 'Yes. Teams and roles decide who sees which coverage, and the CIO can see across all of it.' },
    ],
    close: 'Bring a recent IC memo; we will show it rebuilt on AlphaBoard.',
  },
  {
    slug: 'family-offices',
    name: 'Family offices',
    title: 'For family office investment teams',
    seoTitle: 'Research platform for family offices: direct equity research and manager meetings in one place',
    description: 'AlphaBoard gives family office teams one place for direct equity research, external manager meetings and advisor reports, with an Institutional Memory that answers the principal’s questions from your own documents.',
    lede: 'A family office runs on a small team and a large inbox. AlphaBoard turns direct-equity research, manager meetings and advisor reports into one record per company, so the principal’s question gets an answer the same day.',
    visual: 'needs',
    painsTitle: 'What a small team carries',
    pains: [
      { title: 'Advisor reports nobody reread', body: 'Broker and advisor PDFs arrive daily and disappear into email.' },
      { title: 'The principal’s question', body: '“What do we know about this company?” takes a day of searching for a three-person team.' },
      { title: 'Manager meetings without a home', body: 'Notes from external fund managers live in personal notebooks, not next to the holdings they explain.' },
    ],
    processTitle: 'The family office process',
    process: [
      { title: 'Direct holdings', body: 'Every listed holding and watchlist name gets a record with its filings, reports and notes.' },
      { title: 'External managers', body: 'Meetings with PMS and AIF managers are logged like any other research, with follow-ups.' },
      { title: 'Advisor research', body: 'Broker and advisor reports are uploaded once and answered from by Institutional Memory.' },
      { title: 'The principal’s review', body: 'One screen shows what the team researched, what changed and what is waiting for a decision.' },
    ],
    pointsTitle: 'What changes for a family office',
    points: [
      { title: 'A research team’s memory, without the headcount', body: 'Institutional Memory reads the reports so a small team can answer like a large one.' },
      { title: 'Manager meetings on the record', body: 'Notes, attachments and follow-ups for every external manager you meet.' },
      { title: 'One view for the principal', body: 'Activity, open decisions and quiet holdings on one screen, without a weekly status email.' },
      { title: 'Continuity across advisors', body: 'The record stays with the family when advisors and analysts change.' },
    ],
    proofTitle: 'Sized for a small team',
    proof: 'Most family office teams start with a handful of users and a watchlist. AlphaBoard grows with the coverage, not with headcount.',
    faq: [
      { q: 'We have two people on research. Is this too much?', a: 'Small teams gain the most: Institutional Memory does the reading, and the record keeps everything a larger team would hold in its heads.' },
      { q: 'Can we track external fund managers?', a: 'Yes. Meetings with PMS and AIF managers are logged and kept with their notes, files and follow-ups.' },
      { q: 'Can the principal see everything without logging work?', a: 'Yes. Give the principal a portfolio manager role and the Command Center shows the team’s research and open decisions.' },
    ],
    close: 'Bring your watchlist and a stack of advisor reports to the demo.',
  },
  {
    slug: 'venture-capital',
    name: 'Venture capital',
    title: 'For venture capital teams',
    seoTitle: 'Research platform for venture capital: founder meetings, sector theses and data rooms in one place',
    description: 'AlphaBoard gives venture teams one record per company in the pipeline: founder calls, partner meetings, sector theses and data-room documents, with an Institutional Memory that answers across all of them.',
    lede: 'A venture firm meets hundreds of companies to back a few. AlphaBoard keeps every founder call, partner discussion and data-room document on one record per company, and lets the whole team ask what the firm already knows.',
    visual: 'matrix',
    painsTitle: 'Where a venture firm’s knowledge goes',
    pains: [
      { title: 'Five partners, five notebooks', body: 'Founder call notes sit with whoever took the call. The firm meets a company twice without knowing it.' },
      { title: 'The thesis rebuilt for every deal', body: 'Sector work is redone for each memo because last year’s lives in a deck nobody can find.' },
      { title: 'Data rooms that vanish', body: 'When the deal closes or passes, the documents and the reasoning go with it.' },
    ],
    processTitle: 'The venture process, step by step',
    process: [
      { title: 'Pipeline', body: 'Every company met gets a record: calls, notes, decks and who on the team knows it.' },
      { title: 'Sector theses', body: 'Thesis work is logged against the sector and linked to the companies it touches.' },
      { title: 'Investment memo', body: 'The memo cites the calls, documents and diligence behind it; the partners’ comments stay with it.' },
      { title: 'Portfolio', body: 'Board updates and follow-on discussions land on the same record after the cheque.' },
    ],
    pointsTitle: 'What changes for a venture team',
    points: [
      { title: 'One record per company, met or backed', body: 'The pipeline stops being a spreadsheet of names and becomes the firm’s memory.' },
      { title: 'Institutional Memory over decks and data rooms', body: 'Ask what a founder said about churn last year, or which companies in the pipeline sell to the same buyer.' },
      { title: 'Partner meetings with the evidence', body: 'Comments and decisions sit beside the material they were about.' },
      { title: 'Public comparables in the same place', body: 'Listed peers’ filings and broker research sit beside private companies, for the comparisons memos need.' },
    ],
    proofTitle: 'Private markets, honestly',
    proof: 'The research log, Matrix and Institutional Memory work for private companies today. Private-market data connectors such as Venture Intelligence and PitchBook are on the roadmap.',
    faq: [
      { q: 'Is AlphaBoard built for listed equities only?', a: 'It began with listed-equity desks, and the record, Matrix and Institutional Memory work the same way for private companies. Private-market data feeds are on the connector roadmap.' },
      { q: 'Can we upload data-room documents?', a: 'Yes. Upload decks, financials and diligence reports as PDFs; the Brain answers across them with numbered sources.' },
      { q: 'Does it replace our CRM?', a: 'It holds the research and the reasoning. Keep your CRM for relationships; CRM connectors such as DealCloud and HubSpot are on the roadmap.' },
    ],
    close: 'Bring a company from your pipeline; we will build its record in the demo.',
  },
];

export const ALL_PAGES = [...PRODUCTS, ...SOLUTIONS];
