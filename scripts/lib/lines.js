"use strict";

/**
 * Cria uma função que converte um índice de caractere em número de linha (base 1).
 * Usa busca binária, então é rápida mesmo em arquivos grandes.
 */
function buildLineLookup(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Resume um trecho de texto para mensagens de erro. */
function shorten(text, max = 60) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

module.exports = { buildLineLookup, shorten };
