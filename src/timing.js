import { literalsOf, termToString } from './logic.js';

const bitOf = (minterm, k, width) => (minterm >> (width - 1 - k)) & 1;

export function simulateTransition({ variables, terms, from, to, delays = { not: 1, and: 1, or: 1 }, switchTime = 1 }) {
  const width = variables.length;
  const horizon = switchTime + delays.not + delays.and + delays.or + 8;
  const ticks = [...Array(horizon + 1).keys()];
  const shift = (wave, delay) => wave.map((_, t) => wave[Math.max(t - delay, 0)]);
  const gate = (waves, delay, fn) => shift(ticks.map((t) => fn(waves.map((wave) => wave[t]))), delay);

  const signals = [];
  const inputs = variables.map((name, k) => {
    const wave = ticks.map((t) => bitOf(t < switchTime ? from : to, k, width));
    signals.push({ name, kind: 'input', wave });
    return wave;
  });

  const inverted = new Map();
  const literal = (k, positive) => {
    if (positive) return inputs[k];
    if (!inverted.has(k)) {
      const wave = shift(inputs[k].map((v) => 1 - v), delays.not);
      inverted.set(k, wave);
      signals.push({ name: `${variables[k]}'`, kind: 'gate', wave });
    }
    return inverted.get(k);
  };

  const products = terms.map((term) => {
    const sources = literalsOf(width, term).map(({ k, positive }) => literal(k, positive));
    const wave = gate(sources, delays.and, (values) => (values.every(Boolean) ? 1 : 0));
    signals.push({ name: termToString(variables, term), kind: 'gate', wave });
    return wave;
  });

  const output = gate(products, delays.or, (values) => (values.some(Boolean) ? 1 : 0));
  signals.push({ name: 'F', kind: 'output', wave: output });

  const { glitch, pulses } = findGlitch(output, switchTime);

  return { signals, horizon, switchTime, glitch, pulses };
}

/**
 * Looks for deviations of the output from its initial value after the inputs switch.
 * `pulses` lists every contiguous deviation; `glitch` summarizes them
 * (first start, total width in ns, wrong level) or is null when the output is clean.
 */
export function findGlitch(output, switchTime) {
  const expected = output[0];
  if (output[output.length - 1] !== expected) return { glitch: null, pulses: [] };

  const pulses = [];
  for (let t = switchTime; t < output.length; t++) {
    if (output[t] === expected) continue;
    const last = pulses[pulses.length - 1];
    if (last && last.start + last.width === t) last.width++;
    else pulses.push({ start: t, width: 1 });
  }
  if (!pulses.length) return { glitch: null, pulses };

  const width = pulses.reduce((sum, pulse) => sum + pulse.width, 0);
  return { glitch: { start: pulses[0].start, width, level: 1 - expected }, pulses };
}
