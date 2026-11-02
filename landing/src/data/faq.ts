export interface Faq { q: string; a: string }

export const HOME_FAQ: Faq[] = [
  {
    q: 'What is AlphaBoard?',
    a: 'Institutional memory for Indian investment firms. Analysts log every concall, AGM, broker report and management meeting against the company it belongs to. The Matrix shows that work on one timeline across every analyst and company, the Thinking Board is where data and notes become a published entry, and Institutional Memory lets anyone ask across the firm’s reports.',
  },
  {
    q: 'Who is it built for?',
    a: 'Indian PMS houses, Category II and III AIFs, family offices and venture teams: desks of three to fifty people where the person allocating capital needs to see the research without asking for it.',
  },
  {
    q: 'Does the Matrix fill itself in?',
    a: 'No, and that is deliberate. Entries are logged by your analysts, because the record is worth keeping only if it holds what your people actually read and thought. The Thinking Board makes logging quick: pull the data, write your view, publish.',
  },
  {
    q: 'What can the Thinking Board pull?',
    a: 'Concall analysis, corporate events, news, quarterly results, the income statement, balance sheet and cash flow, ratios and history, and shareholding. Each block carries the name of its source and the date it was fetched, and you can check any of them before you rely on it.',
  },
  {
    q: 'How does the Brain answer?',
    a: 'It reads across the PDFs in your firm’s Institutional Memory and answers with numbered sources. Open a source to read the quote behind the claim, usually with its page. Text-based PDFs work best: scanned documents without a text layer are not read yet. If your reports don’t hold the answer, it says so.',
  },
  {
    q: 'Does it help with SEBI record-keeping?',
    a: 'Every entry is timestamped, attributed to an analyst and kept with its rationale and attachments. That gives your compliance team a research trail to work from. AlphaBoard supports your compliance process; it does not replace your compliance officer.',
  },
  {
    q: 'Where is our data kept, and who can see it?',
    a: 'Every organisation is isolated by row-level security in the database, and inside a firm, visibility follows teams and roles. Documents you add to Institutional Memory are processed by Google’s Gemini to answer questions. We’ll take you through hosting regions and our subprocessors in the demo.',
  },
  {
    q: 'Does it replace Bloomberg, Capitaline or our Excel models?',
    a: 'No. AlphaBoard holds what the desk read, learned and decided. It sits beside the data you already pay for and the models you already build.',
  },
];
