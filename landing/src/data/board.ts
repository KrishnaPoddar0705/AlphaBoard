/**
 * Illustrative desk data for the home-page research log. Companies are fictional on
 * purpose: views on real listed names would read as a research recommendation. Event
 * kinds mirror the app's own frontend/src/lib/commandCenter/constants.ts.
 */

export interface BoardRow {
  ticker: string;
  company: string;
  event: string;
  where: string;
  analyst: string;
  time: string;
  /** Files attached to the entry (transcript, report, model). */
  files: number;
  note: string;
}

export const BOARD: BoardRow[] = [
  { ticker: 'NARMADAFIN', company: 'Narmada Finance', event: 'Concall', where: 'Q2 FY27', analyst: 'R. Iyer', time: '07:58', files: 3, note: 'Credit cost guide cut to 1.6%; collection efficiency back above 98%.' },
  { ticker: 'DECCANAUTO', company: 'Deccan Auto Components', event: 'Plant visit', where: 'Chakan, Pune', analyst: 'S. Mehta', time: '08:10', files: 2, note: 'Second line is running at 60%. Export orders real, but the ramp is two quarters away.' },
  { ticker: 'MALABARPOLY', company: 'Malabar Polymers', event: 'Broker report', where: 'Sell-side initiation', analyst: 'A. Shah', time: '08:21', files: 1, note: 'Street is late: our model had the capacity math in July. Logged to show the variance.' },
  { ticker: 'SAHYADRIEL', company: 'Sahyadri Electronics', event: '1:1 with CFO', where: 'Mumbai office', analyst: 'K. Rao', time: '08:42', files: 2, note: 'Margin guide held at 4.1% despite the mobile mix. View upgraded and pushed to the PM for review.' },
  { ticker: 'VINDHYACEM', company: 'Vindhya Cement', event: 'AGM', where: 'FY26', analyst: 'P. Nair', time: '08:47', files: 1, note: 'Promoter reaffirmed no new capex until net debt falls below 1x EBITDA.' },
  { ticker: 'KONKANCAB', company: 'Konkan Cables', event: 'Group meeting', where: 'NDR, Bengaluru', analyst: 'S. Mehta', time: '08:55', files: 2, note: 'Order book at 2.3x sales; management sounded confident on working capital.' },
  { ticker: 'ARAVALLIPH', company: 'Aravalli Pharma', event: 'Annual report', where: 'FY26 read-through', analyst: 'R. Iyer', time: '09:02', files: 1, note: 'Related-party sales up 40%; contingent liabilities doubled. Flagged to the risk desk.' },
  { ticker: 'COROMANDRT', company: 'Coromandel Retail', event: 'Conference', where: 'Mumbai, day 2', analyst: 'A. Shah', time: '09:09', files: 2, note: 'Same-store growth steady at 9%; new formats break even inside 18 months.' },
  { ticker: 'GODAVARIPW', company: 'Godavari Power', event: 'Call', where: 'IR, ad hoc', analyst: 'K. Rao', time: '09:13', files: 1, note: 'Tariff petition withdrawn. Exit recommended to the PM.' },
];

export const OPEN_INDEX = 3;
