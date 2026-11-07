import { covers, evaluate } from './logic.js';

export function findStaticOneHazards(width, terms) {
  const hazards = [];
  for (let from = 0; from < 1 << width; from++) {
    if (!evaluate(terms, from)) continue;
    for (let variable = 0; variable < width; variable++) {
      const bit = 1 << variable;
      const to = from | bit;
      if (to === from || !evaluate(terms, to)) continue;
      if (terms.some((term) => covers(term, from) && covers(term, to))) continue;
      hazards.push({ from, to, variable });
    }
  }
  return hazards;
}

function isImplicant(width, terms, cube) {
  for (let m = 0; m < 1 << width; m++) {
    if ((m & cube.mask) === cube.value && !evaluate(terms, m)) return false;
  }
  return true;
}

export function addConsensusTerms(width, terms) {
  const result = [...terms];
  const added = [];
  const full = (1 << width) - 1;

  for (const { from, to, variable } of findStaticOneHazards(width, terms)) {
    if (result.some((term) => covers(term, from) && covers(term, to))) continue;

    const dropped = ~(1 << variable);
    let cube = { mask: full & dropped, value: from & dropped };
    for (let bit = 0; bit < width; bit++) {
      if (!(cube.mask & (1 << bit))) continue;
      const wider = { mask: cube.mask & ~(1 << bit), value: cube.value & ~(1 << bit) };
      if (isImplicant(width, terms, wider)) cube = wider;
    }
    result.push(cube);
    added.push(cube);
  }
  return { terms: result, added };
}
