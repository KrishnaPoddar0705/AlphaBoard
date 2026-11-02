/**
 * Renders the Matrix and the Brain's answers to HTML strings. The same functions run at
 * build time (so the page is complete without script) and in the browser (lib/desk.ts).
 */
import { COMPANIES, EVENTS, NOTE, TEAMS, ANSWERS, type Answer, type DeskEvent, type EventType } from '../data/desk';

export type Lens = 'company' | 'analyst';
export type Density = 0 | 2 | 4;
export type Column = EventType | 'Documents';

export interface MatrixState {
  lens: Lens;
  team: string;
  query: string;
  density: Density;
  columns: Column[];
  /** The analyst's view as published from the Thinking Board, if it has been. */
  published: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const COLUMN_LABEL: Record<Column, string> = {
  Documents: 'Source documents', Concall: 'Concall', '1:1': '1:1', 'Plant visit': 'Plant visit',
  'Broker report': 'Broker report', 'Annual report': 'Annual report', AGM: 'AGM',
};

function allEvents(published: string | null): DeskEvent[] {
  if (published === null) return EVENTS;
  const note: DeskEvent = { id: 'published', ...NOTE, excerpt: published, order: 100, file: true };
  return [...EVENTS, note];
}

function entry(e: DeskEvent, lens: Lens, col: Column, excerpt: boolean): string {
  // In a company's row the company is known: say what happened. In an analyst's, say where.
  const who = lens === 'analyst' ? e.ticker : col === 'Documents' ? e.type : e.title;
  const cls = ['dx-e', e.next ? 'is-next' : '', e.id === 'published' ? 'is-new' : ''].filter(Boolean).join(' ');
  return `<li class="${cls}"><span class="dx-who">${e.next ? '<em>Next</em> ' : ''}${esc(who)}</span><span class="dx-date">${esc(e.date)}</span>${excerpt ? `<span class="dx-x">${lens === 'analyst' ? `${esc(e.title)}: ` : ''}${esc(e.excerpt)}</span>` : ''}</li>`;
}

function cell(events: DeskEvent[], col: Column, lens: Lens, density: Density): string {
  const label = esc(COLUMN_LABEL[col]);
  const inCol = col === 'Documents' ? events.filter((e) => e.file) : events.filter((e) => e.type === col);
  if (!inCol.length) return `<div class="dx-cell is-empty" data-label="${label}"><span aria-label="Nothing logged">&ndash;</span></div>`;
  const sorted = [...inCol].sort((a, b) => b.order - a.order);
  if (density === 0) return `<div class="dx-cell" data-label="${label}"><span class="dx-count">${sorted.length}</span> <span class="dx-latest">${esc(sorted[0].date)}</span></div>`;
  const shown = sorted.slice(0, density === 2 ? 2 : 3);
  const more = sorted.length - shown.length;
  return `<div class="dx-cell" data-label="${label}"><ul class="dx-tl">${shown.map((e) => entry(e, lens, col, density === 4)).join('')}</ul>${more > 0 ? `<span class="dx-more">+${more} earlier</span>` : ''}</div>`;
}

const row = (name: string, sub: string, events: DeskEvent[], s: MatrixState, n: number) =>
  `<div class="dx-row" role="row"><div class="dx-name" role="rowheader"><span class="dx-n">${n}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></div>${s.columns.map((c) => cell(events, c, s.lens, s.density)).join('')}</div>`;

export function renderMatrixBody(s: MatrixState): string {
  const events = allEvents(s.published);
  const q = s.query.trim().toLowerCase();
  const hit = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
  let html = '';
  let n = 0;
  let shownEvents = 0;

  if (s.lens === 'company') {
    const inTeam = (t: string) => s.team === 'All teams' || TEAMS.find((x) => x.name === s.team)?.analysts.some((a) => a.name === events.find((e) => e.ticker === t)?.analyst);
    for (const c of COMPANIES) {
      if (!inTeam(c.ticker) || !hit(c.company, c.ticker)) continue;
      const mine = events.filter((e) => e.ticker === c.ticker);
      n += 1; shownEvents += mine.length;
      html += row(c.company, c.sector, mine, s, n);
    }
  } else {
    for (const t of TEAMS) {
      if (s.team !== 'All teams' && s.team !== t.name) continue;
      const people = t.analysts.filter((a) => hit(a.name, t.name) || events.some((e) => e.analyst === a.name && hit(e.company, e.ticker)));
      if (!people.length) continue;
      html += `<div class="dx-group" role="row"><span role="cell">${esc(t.name)}</span></div>`;
      for (const a of people) {
        const mine = events.filter((e) => e.analyst === a.name);
        n += 1; shownEvents += mine.length;
        html += row(a.name, a.role, mine, s, n);
      }
    }
  }
  if (!n) html = '<p class="dx-none">Nothing on the desk matches that.</p>';
  const noun = s.lens === 'company' ? 'companies' : 'analysts';
  return `<p class="dx-sum" aria-live="polite">${n} ${n === 1 ? noun.replace(/ies$/, 'y').replace(/s$/, '') : noun} · ${shownEvents} entries · last 12 months</p><div class="dx-table" role="table" aria-label="Research events by ${s.lens}"><div class="dx-row dx-head" role="row"><div role="columnheader">${s.lens === 'company' ? 'Company' : 'Analyst'}</div>${s.columns.map((c) => `<div role="columnheader">${esc(COLUMN_LABEL[c])}</div>`).join('')}</div>${html}</div>`;
}

/** The Brain's answer: citation markers become buttons that open their source. */
export function renderAnswer(a: Answer): string {
  const body = esc(a.answer).replace(/\{(\d+)\}/g, (_, n) => `<button type="button" class="br-cite" data-cite="${n}" aria-label="Source ${n}: ${esc(a.sources[Number(n) - 1].title)}">${n}</button>`);
  return `<p class="br-a">${body}</p><ol class="br-src">${a.sources
    .map((src, i) => `<li data-src="${i + 1}"><span class="br-num">${i + 1}</span><span class="br-t"><b>${esc(src.kind)}</b> · ${esc(src.title)}, ${esc(src.where)}<small>${esc(src.who)} · ${esc(src.when)}</small><q hidden>${esc(src.quote)}</q></span></li>`)
    .join('')}</ol>`;
}

export const answerFor = (text: string) => {
  const q = text.toLowerCase();
  return ANSWERS.find((a) => a.keys.some((k) => q.includes(k))) ?? null;
};
