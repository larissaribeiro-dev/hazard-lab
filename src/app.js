import { parseSop, covers, evaluate, termToString } from './logic.js';
import { findStaticOneHazards, addConsensusTerms } from './hazards.js';
import { simulateTransition } from './timing.js';
import { initSplitter } from './splitter.js';

const $ = (id) => document.getElementById(id);
const DASHBOARD = window.matchMedia('(min-width: 1100px) and (min-height: 620px)');
const COLORS = ['#7c7cff', '#ff6b8b', '#f2b84b', '#3ddc97', '#4fc3f7', '#c792ea', '#ff9e64', '#9aa7d1'];
const EXAMPLES = [
  { label: 'Multiplexador 2:1', expression: "AB + A'C" },
  { label: 'Quatro variáveis', expression: "A'C + AD + AB'" },
  { label: 'Sem hazards', expression: "AB + A'C + BC" },
];
const state = { circuit: null, hazards: [], fixed: null, selected: 0, showFixed: false, reversed: false };

const bin = (value, width) => value.toString(2).padStart(width, '0');
const gray = (i) => i ^ (i >> 1);
const activeTerms = () => (state.showFixed && state.fixed ? state.fixed.terms : state.circuit.terms);
const currentHazard = () => state.hazards[state.selected] ?? null;
const delays = () => ({ not: +$('d-not').value, and: +$('d-and').value, or: +$('d-or').value });
const simulate = (terms, from, to) =>
  simulateTransition({ variables: state.circuit.variables, terms, from, to, delays: delays() });

function select(index) {
  state.selected = index;
  const hazard = currentHazard();
  if (!hazard) return;
  const forward = simulate(state.circuit.terms, hazard.from, hazard.to).glitch;
  const backward = simulate(state.circuit.terms, hazard.to, hazard.from).glitch;
  state.reversed = !forward && Boolean(backward);
}

function analyze() {
  $('error').textContent = '';
  try {
    state.circuit = parseSop($('expr').value);
  } catch (error) {
    $('error').textContent = error.message;
    $('stats').hidden = $('dash').hidden = true;
    return;
  }
  const width = state.circuit.variables.length;
  state.hazards = findStaticOneHazards(width, state.circuit.terms);
  state.fixed = state.hazards.length ? addConsensusTerms(width, state.circuit.terms) : null;
  state.showFixed = false;
  select(0);
  $('stats').hidden = $('dash').hidden = false;
  render();
}

function render() {
  renderKMap();
  renderHazards();
  renderScope();
}

function renderKMap() {
  const { variables } = state.circuit;
  const width = variables.length;
  const terms = activeTerms();
  const original = state.circuit.terms.length;
  const rowBits = width >> 1;
  const colBits = width - rowBits;
  const hazard = currentHazard();
  const columns = Array.from({ length: 1 << colBits }, (_, c) => gray(c));

  const header = columns.map((g) => `<th scope="col">${bin(g, colBits)}</th>`).join('');
  const body = Array.from({ length: 1 << rowBits }, (_, r) => {
    const cells = columns.map((g) => {
      const m = (gray(r) << colBits) | g;
      const on = evaluate(terms, m);
      const dots = terms
        .map((t, i) => (covers(t, m) ? `<i class="${i >= original ? 'added' : ''}" style="--c:${COLORS[i % COLORS.length]}"></i>` : ''))
        .join('');
      const focus = hazard && (m === hazard.from || m === hazard.to) ? ' focus' : '';
      return `<td class="${on ? 'on' : ''}${focus}"><b>${on ? 1 : 0}</b><small>${m}</small><span>${dots}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${bin(gray(r), rowBits)}</th>${cells}</tr>`;
  }).join('');

  const corner = `${variables.slice(0, rowBits).join('')}/${variables.slice(rowBits).join('')}`;
  $('kmap').innerHTML = `<thead><tr><th class="corner">${corner}</th>${header}</tr></thead><tbody>${body}</tbody>`;
  $('legend').innerHTML = terms
    .map((t, i) => `<li><i class="${i >= original ? 'added' : ''}" style="--c:${COLORS[i % COLORS.length]}"></i><code>${termToString(variables, t)}</code>${i >= original ? '<em>consenso</em>' : ''}</li>`)
    .join('');
}

function setBadge(id, text, kind) {
  $(id).textContent = text;
  $(id).className = `badge ${kind}`;
}

function renderStats(sim) {
  const { variables, terms } = state.circuit;
  const count = state.hazards.length;
  $('k-vars').textContent = variables.length;
  setBadge('b-vars', variables.join(' '), 'info');
  $('k-terms').textContent = terms.length;
  if (state.fixed) setBadge('b-terms', `+${state.fixed.added.length} para corrigir`, 'info');
  else setBadge('b-terms', 'cobertura completa', 'good');
  $('k-hz').textContent = count;
  setBadge('b-hz', count ? 'risco de glitch' : 'livre', count ? 'bad' : 'good');
  $('k-glitch').textContent = sim ? `${sim.glitch ? sim.glitch.width : 0} ns` : '0 ns';
  if (sim && sim.glitch) setBadge('b-glitch', `pulso em ${sim.glitch.level}`, 'bad');
  else setBadge('b-glitch', 'saída estável', 'good');
}

function renderHazards() {
  const { variables } = state.circuit;
  const width = variables.length;
  $('hz-panel').className = `card hz-panel ${state.hazards.length ? 'bad' : 'good'}`;
  $('tabs').hidden = !state.fixed;
  $('reverse').hidden = !state.hazards.length;
  if (!state.hazards.length) {
    $('hazards').innerHTML = '<p class="ok">Nenhum hazard estático-1. Toda transição entre células adjacentes com saída 1 é coberta por um único termo.</p>';
    $('fix').innerHTML = '';
    return;
  }
  const items = state.hazards
    .map((h, i) => `<button class="hz${i === state.selected ? ' active' : ''}" data-i="${i}"><span>${variables[width - 1 - h.variable]} muda</span><code>${bin(h.from, width)} ↔ ${bin(h.to, width)}</code></button>`)
    .join('');
  $('hazards').innerHTML = `<p class="hint">${state.hazards.length} transição(ões) adjacente(s) com saída 1 sem termo em comum. Selecione uma para simular.</p><div class="hz-list">${items}</div>`;

  const original = state.circuit.terms.length;
  const sop = state.fixed.terms
    .map((t, i) => (i >= original ? `<mark>${termToString(variables, t)}</mark>` : termToString(variables, t)))
    .join(' + ');
  $('fix').innerHTML = `<h3>Cobertura sem hazards</h3><p class="sop">${sop}</p><p class="hint">Os termos destacados são implicantes primos que cobrem os pares adjacentes descobertos.</p>`;
}

function renderScope() {
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.view === 'fixed') === state.showFixed)));
  const hazard = currentHazard();
  if (!hazard) {
    $('summary').textContent = '';
    renderStats(null);
    $('scope-body').innerHTML = '<p class="empty">Sem hazards para simular. Remova um termo de consenso da expressão para ver um glitch.</p>';
    return;
  }
  const width = state.circuit.variables.length;
  const [from, to] = state.reversed ? [hazard.to, hazard.from] : [hazard.from, hazard.to];
  const sim = simulate(activeTerms(), from, to);
  const verdict = sim.glitch
    ? `<strong class="bad">glitch em ${sim.glitch.level} por ${sim.glitch.width} ns</strong>`
    : '<strong class="good">saída estável</strong>';
  $('summary').innerHTML = `${bin(from, width)} → ${bin(to, width)} · F deveria ficar em ${evaluate(state.circuit.terms, from) ? 1 : 0} · ${verdict}`;
  renderStats(sim);
  $('scope-body').innerHTML = drawWaves(sim);
}

function drawWaves({ signals, horizon, switchTime, glitch, pulses }) {
  const LABEL = 120, TOP = 24;
  const body = $('scope-body');
  const fill = DASHBOARD.matches && body.clientHeight > 120;
  const STEP = fill
    ? Math.max(12, (body.clientWidth - LABEL - 16) / horizon)
    : Math.max(20, Math.min(60, Math.floor(740 / horizon)));
  const ROW = fill ? Math.max(24, Math.min(72, Math.floor((body.clientHeight - TOP - 8) / signals.length))) : 32;
  const x = (t) => LABEL + t * STEP;
  const y = (row, v) => TOP + row * ROW + ROW * (v ? 0.18 : 0.72);
  const W = x(horizon) + 12;
  const H = TOP + signals.length * ROW + 8;
  const grid = Array.from({ length: horizon + 1 }, (_, t) => `<line class="g" x1="${x(t)}" x2="${x(t)}" y1="${TOP - 6}" y2="${H - 8}"/>${t % 2 === 0 ? `<text x="${x(t) - 4}" y="14">${t}</text>` : ''}`).join('');
  const rows = signals.map((s, row) => {
    let d = `M ${x(0)} ${y(row, s.wave[0])}`;
    for (let t = 1; t <= horizon; t++) if (s.wave[t] !== s.wave[t - 1]) d += ` H ${x(t)} V ${y(row, s.wave[t])}`;
    d += ` H ${x(horizon)}`;
    const bad = s.kind === 'output' && glitch ? ' bad' : '';
    return `<text x="8" y="${y(row, 0) - 6}">${s.name}</text><path class="tr ${s.kind}${bad}" d="${d}"/>`;
  }).join('');
  const outRow = signals.length - 1;
  const flag = pulses
    .map((p) => `<rect class="flag" x="${x(p.start)}" y="${TOP + outRow * ROW}" width="${p.width * STEP}" height="${ROW - 4}"/>`)
    .join('');
  const mark = `<line class="mark" x1="${x(switchTime)}" x2="${x(switchTime)}" y1="${TOP - 6}" y2="${H - 8}"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Formas de onda dos sinais, tempo em nanossegundos">${grid}${mark}${flag}${rows}</svg>`;
}

function init() {
  $('examples').innerHTML = EXAMPLES.map((e) => `<button data-expression="${e.expression}">${e.label}</button>`).join('');
  $('examples').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    $('expr').value = button.dataset.expression;
    analyze();
  });
  $('expr').addEventListener('input', analyze);
  for (const key of ['not', 'and', 'or']) {
    $(`d-${key}`).addEventListener('input', () => {
      $(`v-${key}`).textContent = $(`d-${key}`).value;
      if (state.circuit) {
        select(state.selected);
        renderScope();
      }
    });
  }
  $('hazards').addEventListener('click', (event) => {
    const item = event.target.closest('[data-i]');
    if (!item) return;
    select(Number(item.dataset.i));
    render();
  });
  $('tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-view]');
    if (!tab) return;
    state.showFixed = tab.dataset.view === 'fixed';
    render();
  });
  $('reverse').addEventListener('click', () => {
    state.reversed = !state.reversed;
    renderScope();
  });
  window.addEventListener('resize', () => {
    if (state.circuit) renderScope();
  });
  initSplitter({
    grid: $('dash'),
    top: document.querySelector('.km-panel'),
    bottom: $('hz-panel'),
    handle: $('splitter'),
    desktop: DASHBOARD,
    watch: [$('kmap'), $('hazards'), $('fix')],
  });
  analyze();
}

init();
