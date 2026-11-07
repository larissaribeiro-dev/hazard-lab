const VARIABLE_NAMES = 'ABCDEF';

export function parseSop(source) {
  const text = source.replace(/[\s*.]/g, '').toUpperCase();
  if (!text) throw new Error("Digite uma expressão em soma de produtos, por exemplo A'C + AD + AB'.");

  const parsed = text.split('+').map(parseTerm);
  const variables = [...new Set(parsed.flatMap((literals) => [...literals.keys()]))].sort();
  const width = variables.length;

  const seen = new Set();
  const terms = [];
  for (const literals of parsed) {
    let mask = 0;
    let value = 0;
    for (const [name, negated] of literals) {
      const bit = 1 << (width - 1 - variables.indexOf(name));
      mask |= bit;
      if (!negated) value |= bit;
    }
    const key = `${mask}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      terms.push({ mask, value });
    }
  }
  return { variables, terms };
}

function parseTerm(chunk) {
  if (!chunk) throw new Error('Termo vazio: verifique os sinais "+".');
  const literals = new Map();
  let i = 0;
  while (i < chunk.length) {
    let negated = chunk[i] === '!';
    if (negated) i++;
    const name = chunk[i++];
    if (!name || !VARIABLE_NAMES.includes(name)) {
      throw new Error(`Símbolo inválido "${name ?? chunk}" no termo "${chunk}". Use as variáveis A a F.`);
    }
    while (chunk[i] === "'") {
      negated = !negated;
      i++;
    }
    if (literals.has(name) && literals.get(name) !== negated) {
      throw new Error(`O termo "${chunk}" contém ${name} e ${name}' ao mesmo tempo.`);
    }
    literals.set(name, negated);
  }
  return literals;
}

export const covers = (term, minterm) => (minterm & term.mask) === term.value;

export const evaluate = (terms, minterm) => terms.some((term) => covers(term, minterm));

export function literalsOf(width, term) {
  const literals = [];
  for (let k = 0; k < width; k++) {
    const bit = 1 << (width - 1 - k);
    if (term.mask & bit) literals.push({ k, positive: Boolean(term.value & bit) });
  }
  return literals;
}

export function termToString(variables, term) {
  const text = literalsOf(variables.length, term)
    .map(({ k, positive }) => variables[k] + (positive ? '' : "'"))
    .join('');
  return text || '1';
}

export const formatSop = (variables, terms) => terms.map((term) => termToString(variables, term)).join(' + ');
