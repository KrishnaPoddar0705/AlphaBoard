/**
 * One source of truth for /integrations, the home-page connector table, llms.txt
 * and FEATURES.md (epics E4-E7). Status is honest: "Live" means it is in the codebase
 * today; everything else is "Beta" or "Roadmap".
 */
export type ConnectorStatus = 'Live' | 'Beta' | 'Roadmap';
export type ConnectorCategory =
  | 'Indian market data'
  | 'Filings & disclosures'
  | 'Research & ratings'
  | 'Global data'
  | 'Private markets'
  | 'Documents & mail'
  | 'CRM & messaging'
  | 'Data warehouse'
  | 'Agents';

export interface Connector {
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  does: string;
}

export const CONNECTORS: Connector[] = [
  // Live today
  { name: 'NSE & BSE prices', category: 'Indian market data', status: 'Live', does: 'End-of-day and intraday prices for every covered name, on its company record.' },
  { name: 'Indian market news', category: 'Indian market data', status: 'Live', does: 'Economic Times, Moneycontrol and Google News headlines per ticker, with plain-English summaries.' },
  { name: 'WhatsApp', category: 'CRM & messaging', status: 'Live', does: 'Prices, alerts, watchlist and recommendations from the chat your desk already uses, plus a daily close report.' },
  { name: 'Broker report PDFs', category: 'Research & ratings', status: 'Live', does: 'Upload annual reports, results filings, sell-side and internal reports; Institutional Memory reads and answers across them.' },
  { name: 'Notion', category: 'Documents & mail', status: 'Live', does: 'Export an investment thesis to a Notion page.' },
  { name: 'PDF export', category: 'Documents & mail', status: 'Live', does: 'Export a thesis or a stock page as a PDF for the IC pack.' },
  { name: 'Single sign-on', category: 'CRM & messaging', status: 'Live', does: 'Sign-in through Clerk, with organisation roles: admin, portfolio manager, analyst.' },

  // India roadmap
  { name: 'NSE & BSE announcements', category: 'Filings & disclosures', status: 'Roadmap', does: 'Corporate announcements, results, board meetings and outcomes, attached to the stock on arrival.' },
  { name: 'SEBI filings', category: 'Filings & disclosures', status: 'Roadmap', does: 'SAST and insider-trading disclosures, offer documents and orders.' },
  { name: 'Shareholding & pledges', category: 'Filings & disclosures', status: 'Roadmap', does: 'Quarterly shareholding patterns, promoter pledge changes and bulk or block deals.' },
  { name: 'MCA21', category: 'Filings & disclosures', status: 'Roadmap', does: 'Company master data, charges and financial filings for listed and unlisted companies.' },
  { name: 'Concall transcripts', category: 'Research & ratings', status: 'Roadmap', does: 'Earnings-call transcripts linked to the concall entry they belong to.' },
  { name: 'CRISIL, ICRA, CARE', category: 'Research & ratings', status: 'Roadmap', does: 'Credit ratings and rating actions on covered issuers.' },
  { name: 'Screener.in', category: 'Indian market data', status: 'Roadmap', does: 'Fundamentals and ratios beside your own model.' },
  { name: 'Trendlyne', category: 'Indian market data', status: 'Roadmap', does: 'Consensus estimates, broker targets and forensic scores.' },
  { name: 'Tijori', category: 'Indian market data', status: 'Roadmap', does: 'Segment and operating KPIs for Indian companies.' },
  { name: 'ACE Equity', category: 'Indian market data', status: 'Roadmap', does: 'Historical financials and corporate actions.' },
  { name: 'CMIE Prowess', category: 'Indian market data', status: 'Roadmap', does: 'Deep company and industry datasets for screening.' },
  { name: 'Capitaline', category: 'Indian market data', status: 'Roadmap', does: 'Financial statements and shareholding history.' },
  { name: 'AMFI', category: 'Indian market data', status: 'Roadmap', does: 'Mutual fund holdings, to see who else owns the name.' },
  { name: 'Zerodha Kite', category: 'Indian market data', status: 'Roadmap', does: 'Read-only positions, so the model book and the real book sit side by side.' },
  { name: 'Account Aggregator', category: 'Indian market data', status: 'Roadmap', does: 'Consented holdings data for family-office and wealth clients.' },
  { name: 'smallcase', category: 'Indian market data', status: 'Roadmap', does: 'Publish a model portfolio as a smallcase.' },

  // Global
  { name: 'Bloomberg', category: 'Global data', status: 'Roadmap', does: 'Prices, estimates and news for desks that already hold a terminal licence.' },
  { name: 'LSEG Workspace', category: 'Global data', status: 'Roadmap', does: 'Fundamentals, estimates and transcripts.' },
  { name: 'FactSet', category: 'Global data', status: 'Roadmap', does: 'Company, deal and sell-side estimate data.' },
  { name: 'S&P Capital IQ', category: 'Global data', status: 'Roadmap', does: 'Financials, transcripts and broker estimates.' },
  { name: 'PitchBook', category: 'Private markets', status: 'Roadmap', does: 'Private company, deal and investor data.' },
  { name: 'Preqin', category: 'Private markets', status: 'Roadmap', does: 'Funds, LPs and deal activity.' },
  { name: 'Venture Intelligence', category: 'Private markets', status: 'Roadmap', does: 'Indian private equity and venture deals.' },
  { name: 'VCCEdge', category: 'Private markets', status: 'Roadmap', does: 'Indian private company financials and transactions.' },

  // Documents, CRM, warehouses
  { name: 'Gmail & Outlook', category: 'Documents & mail', status: 'Roadmap', does: 'Broker mail lands in the right stock page, tagged by sender and ticker.' },
  { name: 'Google Drive', category: 'Documents & mail', status: 'Roadmap', does: 'Models and notes searchable from Institutional Memory.' },
  { name: 'SharePoint & OneDrive', category: 'Documents & mail', status: 'Roadmap', does: 'Firm documents searchable without moving them.' },
  { name: 'Box & Dropbox', category: 'Documents & mail', status: 'Roadmap', does: 'Search and cite files where they already live.' },
  { name: 'Slack & Teams', category: 'CRM & messaging', status: 'Roadmap', does: 'Post new entries and PM decisions to a desk channel.' },
  { name: 'Salesforce & HubSpot', category: 'CRM & messaging', status: 'Roadmap', does: 'Client and distributor context for wealth teams.' },
  { name: 'DealCloud', category: 'CRM & messaging', status: 'Roadmap', does: 'Deal and relationship data for private-markets teams.' },
  { name: 'Snowflake', category: 'Data warehouse', status: 'Roadmap', does: 'Query the research log alongside your own data.' },
  { name: 'Databricks & BigQuery', category: 'Data warehouse', status: 'Roadmap', does: 'Nightly export of entries, notes and activity.' },

  // Agents
  { name: 'AlphaBoard MCP server', category: 'Agents', status: 'Roadmap', does: 'Let Claude, ChatGPT and Cursor read coverage, the research log, the Matrix and Institutional Memory, with the user’s permissions.' },
];

export const CATEGORIES = [...new Set(CONNECTORS.map((c) => c.category))];
