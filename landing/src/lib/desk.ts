/**
 * The page's one live thing: a note written on the Thinking Board, published to the log,
 * appearing in every Matrix on the page. It stops there, as it does in the app: the Brain
 * reads uploaded reports, not log entries. State lives in memory for the visit. Each
 * fragment mounts from its own [data-*] root.
 */
import { track } from './analytics';
import { renderAnswer, renderMatrixBody, answerFor, type Column, type Density, type Lens, type MatrixState } from './desk-render';
import { ANSWERS, NOTE, PASSAGES } from '../data/desk';

const PUBLISHED = 'desk:published';
let published: string | null = null;

const publish = (view: string) => {
  published = view;
  document.dispatchEvent(new CustomEvent(PUBLISHED));
};

function setPressed(buttons: NodeListOf<HTMLElement>, active: HTMLElement) {
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));
}

export function mountMatrix(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>('[data-mx-body]')!;
  const state: MatrixState = {
    lens: (root.dataset.lens as Lens) ?? 'analyst',
    team: 'All teams',
    query: '',
    density: Number(root.dataset.density ?? 2) as Density,
    columns: JSON.parse(root.dataset.columns!) as Column[],
    published,
  };
  const paint = () => { state.published = published; body.innerHTML = renderMatrixBody(state); };

  const lensBtns = root.querySelectorAll<HTMLElement>('[data-mx-lens]');
  lensBtns.forEach((b) => b.addEventListener('click', () => {
    state.lens = b.dataset.mxLens as Lens;
    setPressed(lensBtns, b);
    track('matrix_lens_changed', { lens: state.lens });
    paint();
  }));
  const densBtns = root.querySelectorAll<HTMLElement>('[data-mx-density]');
  densBtns.forEach((b) => b.addEventListener('click', () => {
    state.density = Number(b.dataset.mxDensity) as Density;
    setPressed(densBtns, b);
    paint();
  }));
  const teamBtns = root.querySelectorAll<HTMLElement>('[data-mx-team]');
  teamBtns.forEach((b) => b.addEventListener('click', () => {
    state.team = b.dataset.mxTeam!;
    setPressed(teamBtns, b);
    paint();
  }));
  root.querySelector<HTMLInputElement>('[data-mx-filter]')?.addEventListener('input', (e) => {
    state.query = (e.target as HTMLInputElement).value;
    paint();
  });

  document.addEventListener(PUBLISHED, paint);
  paint();
}

export function mountBoard(root: HTMLElement): void {
  const view = root.querySelector<HTMLTextAreaElement>('[data-view]')!;
  const viewOut = root.querySelector<HTMLElement>('[data-view-out]')!;
  const words = root.querySelector<HTMLElement>('[data-words]')!;
  const note = root.querySelector<HTMLElement>('[data-note]')!;
  const publishBtn = root.querySelector<HTMLButtonElement>('[data-publish]')!;
  const done = root.querySelector<HTMLElement>('[data-done]')!;

  const count = () => { words.textContent = String((note.innerText.match(/\S+/g) ?? []).length); };
  const syncView = () => {
    viewOut.textContent = view.value;
    count();
    publishBtn.textContent = published === null ? 'Publish to log' : 'Update log entry';
  };
  view.addEventListener('input', syncView);

  root.querySelectorAll<HTMLButtonElement>('[data-pull]').forEach((b) => {
    const id = b.dataset.pull!;
    const block = root.querySelector<HTMLElement>(`[data-block="${id}"]`)!;
    b.addEventListener('click', () => {
      const on = !block.classList.contains('is-on');
      block.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      count();
      if (on) {
        track('board_block_inserted', { block: id });
        note.scrollTo({ top: block.offsetTop - 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  });

  publishBtn.addEventListener('click', () => {
    publish(view.value.trim() || NOTE.view);
    done.hidden = false;
    track('board_published', { words: Number(words.textContent) });
    syncView();
  });
  syncView();
}

export function mountMemory(root: HTMLElement): void {
  // The accordion: one panel open, the others slivers.
  const panels = root.querySelectorAll<HTMLElement>('[data-panel]');
  panels.forEach((p) => p.querySelector('[data-panel-open]')!.addEventListener('click', () => {
    panels.forEach((x) => {
      x.classList.toggle('is-open', x === p);
      x.querySelector('[data-panel-open]')!.setAttribute('aria-expanded', String(x === p));
    });
  }));

  // Ask.
  const ansEl = root.querySelector<HTMLElement>('[data-answer]')!;
  const input = root.querySelector<HTMLInputElement>('[data-ask-input]')!;
  let current = ANSWERS[0];
  const paint = () => { ansEl.innerHTML = renderAnswer(current); };
  const ask = (text: string) => {
    const a = answerFor(text);
    if (!a) {
      ansEl.innerHTML = `<p class="br-a">The sample desk holds nothing on that. Try one of the questions above. In your firm, the Brain reads your own reports and says so when they don’t hold the answer.</p>`;
      return;
    }
    current = a;
    paint();
    track('brain_question_answered', { company: a.company });
  };
  root.querySelectorAll<HTMLButtonElement>('[data-ask]').forEach((b) => b.addEventListener('click', () => {
    input.value = b.textContent!.trim();
    ask(input.value);
  }));
  root.querySelector('[data-ask-form]')!.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) ask(input.value);
  });
  ansEl.addEventListener('click', (e) => {
    const cite = (e.target as HTMLElement).closest<HTMLElement>('[data-cite]');
    if (!cite) return;
    ansEl.querySelectorAll('[data-src]').forEach((li) => {
      const on = (li as HTMLElement).dataset.src === cite.dataset.cite;
      li.classList.toggle('is-open', on);
      li.querySelector('q')!.hidden = !on;
    });
  });
  paint();

  // Search: every passage holding the phrase, with the page it sits on.
  const hits = root.querySelector<HTMLElement>('[data-hits]')!;
  root.querySelector<HTMLInputElement>('[data-search]')!.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    hits.querySelectorAll<HTMLElement>('[data-hit]').forEach((li, i) => {
      li.hidden = !!q && !`${PASSAGES[i].report} ${PASSAGES[i].text}`.toLowerCase().includes(q);
    });
    const n = hits.querySelectorAll('[data-hit]:not([hidden])').length;
    root.querySelector<HTMLElement>('[data-hit-count]')!.textContent = `${n} ${n === 1 ? 'passage' : 'passages'}`;
  });

  // Folders: the same reports, regrouped.
  const groupBtns = root.querySelectorAll<HTMLElement>('[data-group]');
  groupBtns.forEach((b) => b.addEventListener('click', () => {
    setPressed(groupBtns, b);
    root.querySelectorAll<HTMLElement>('[data-folders]').forEach((f) => { f.hidden = f.dataset.folders !== b.dataset.group; });
  }));
}

/** The slider: a stated formula and nothing else. */
export function mountFigure(root: HTMLElement): void {
  const range = root.querySelector<HTMLInputElement>('input[type=range]')!;
  const paint = () => {
    const n = Number(range.value);
    root.querySelector('[data-companies]')!.textContent = String(n);
    root.querySelector('[data-records]')!.textContent = (n * 6).toLocaleString('en-IN');
  };
  range.addEventListener('input', paint);
  paint();
}
