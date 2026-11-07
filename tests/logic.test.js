import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSop, evaluate, formatSop } from '../src/logic.js';
import { findStaticOneHazards, addConsensusTerms } from '../src/hazards.js';

const EXPRESSION = "A'C + AD + AB'";

test('parses variables and terms in alphabetical order', () => {
  const { variables, terms } = parseSop(EXPRESSION);
  assert.deepEqual(variables, ['A', 'B', 'C', 'D']);
  assert.equal(formatSop(variables, terms), EXPRESSION);
});

test('accepts explicit operators, prefix negation and lowercase input', () => {
  const { variables, terms } = parseSop('!a*c + a.d');
  assert.equal(formatSop(variables, terms), "A'C + AD");
});

test('rejects empty input, invalid symbols and contradictory terms', () => {
  assert.throws(() => parseSop('   '));
  assert.throws(() => parseSop('A + + B'));
  assert.throws(() => parseSop('A & B'));
  assert.throws(() => parseSop("AA'"));
});

test('evaluates the function over every minterm', () => {
  const { terms } = parseSop('AB + C');
  const ones = [...Array(8).keys()].filter((m) => evaluate(terms, m));
  assert.deepEqual(ones, [1, 3, 5, 6, 7]);
});

test("finds the static-1 hazards of A'C + AD + AB'", () => {
  const { variables, terms } = parseSop(EXPRESSION);
  const hazards = findStaticOneHazards(variables.length, terms);
  assert.deepEqual(hazards.map((h) => [h.from, h.to]), [[2, 10], [3, 11], [7, 15]]);
});

test('reports no hazard when every adjacent pair shares a term', () => {
  const { variables, terms } = parseSop("AB + A'C + BC");
  assert.equal(findStaticOneHazards(variables.length, terms).length, 0);
});

test('consensus terms remove every hazard without changing the function', () => {
  const { variables, terms } = parseSop(EXPRESSION);
  const fixed = addConsensusTerms(variables.length, terms);
  assert.ok(fixed.added.length > 0);
  assert.equal(findStaticOneHazards(variables.length, fixed.terms).length, 0);
  for (let m = 0; m < 1 << variables.length; m++) {
    assert.equal(evaluate(fixed.terms, m), evaluate(terms, m));
  }
});

test('multiplexer example gains the BC consensus term', () => {
  const { variables, terms } = parseSop("AB + A'C");
  const fixed = addConsensusTerms(variables.length, terms);
  assert.equal(formatSop(variables, fixed.terms), "AB + A'C + BC");
});
