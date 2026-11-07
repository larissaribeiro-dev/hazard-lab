import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSop } from '../src/logic.js';
import { addConsensusTerms } from '../src/hazards.js';
import { simulateTransition, findGlitch } from '../src/timing.js';

const { variables, terms } = parseSop("A'C + AD + AB'");
const unit = { not: 1, and: 1, or: 1 };

test('hazardous cover produces a 0-glitch of one gate delay on 1011 to 0011', () => {
  const { glitch } = simulateTransition({ variables, terms, from: 0b1011, to: 0b0011, delays: unit });
  assert.deepEqual(glitch, { start: 3, width: 1, level: 0 });
});

test('the same transition has no glitch after adding consensus terms', () => {
  const fixed = addConsensusTerms(variables.length, terms).terms;
  const { glitch } = simulateTransition({ variables, terms: fixed, from: 0b1011, to: 0b0011, delays: unit });
  assert.equal(glitch, null);
});

test('a faster inverter path hides the glitch', () => {
  const delays = { not: 0, and: 1, or: 1 };
  const { glitch } = simulateTransition({ variables, terms, from: 0b1011, to: 0b0011, delays });
  assert.equal(glitch, null);
});

test('transitions that change the output are not reported as glitches', () => {
  const { glitch } = simulateTransition({ variables, terms, from: 0b0000, to: 0b0011, delays: unit });
  assert.equal(glitch, null);
});

test('output waveform settles to the final function value', () => {
  const { signals } = simulateTransition({ variables, terms, from: 0b0000, to: 0b0011, delays: unit });
  const output = signals.find((s) => s.kind === 'output').wave;
  assert.equal(output[0], 0);
  assert.equal(output.at(-1), 1);
});

test('findGlitch reports every separate pulse and the total width', () => {
  const { glitch, pulses } = findGlitch([1, 1, 0, 1, 1, 0, 0, 1, 1], 1);
  assert.deepEqual(pulses, [{ start: 2, width: 1 }, { start: 5, width: 2 }]);
  assert.deepEqual(glitch, { start: 2, width: 3, level: 0 });
});

test('findGlitch ignores waveforms that do not settle at the initial value', () => {
  assert.deepEqual(findGlitch([0, 0, 1, 1, 1], 1), { glitch: null, pulses: [] });
});
