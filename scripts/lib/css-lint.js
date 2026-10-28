"use strict";

/**
 * Validador de CSS sem dependências.
 *
 * Detecta erros de sintaxe que fazem o navegador descartar regras inteiras:
 * chaves e parênteses sem par, comentários e textos entre aspas sem fechamento,
 * blocos sem seletor, declarações sem "propriedade: valor" e cores hexadecimais
 * inválidas. Aceita @media/@supports, propriedades personalizadas (--x),
 * CSS aninhado e url(data:...).
 *
 * Uso:
 *   const { lintCss } = require("./css-lint");
 *   const erros = lintCss(codigoCss); // [{ line, rule, message }]
 */

const { buildLineLookup, shorten } = require("./lines");

const WHITESPACE = /\s/;
const DECLARATION = /^(--[\w-]+|-{0,2}[a-zA-Z_][\w-]*)\s*:\s*([\s\S]*)$/;
const HEX_COLOR = /^([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const blank = (text) => text.replace(/[^\n]/g, " ");
const fill = (text) => text.replace(/[^\n]/g, "_");

/**
 * Troca comentários por espaços e o conteúdo de textos entre aspas por "_",
 * mantendo o tamanho e as quebras de linha. Assim o parser não se confunde
 * com { } ; dentro de comentários ou strings.
 */
function scrub(source, report) {
  const n = source.length;
  let out = "";
  let i = 0;

  while (i < n) {
    const c = source[i];

    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) {
        report(i, "unterminated-comment", "Comentário /* sem o */ de fechamento.");
        out += blank(source.slice(i));
        break;
      }
      out += blank(source.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        const d = source[j];
        if (d === "\\") { j += 2; continue; }
        if (d === c) { closed = true; break; }
        if (d === "\n") break;
        j++;
      }
      if (!closed) {
        report(i, "unterminated-string", "Texto entre aspas sem fechamento.");
        out += c + fill(source.slice(i + 1, j));
        i = j;
      } else {
        out += c + fill(source.slice(i + 1, j)) + c;
        i = j + 1;
      }
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

/** Valida o CSS e devolve a lista de erros ordenada por linha. */
function lintCss(source) {
  if (source.trim() === "") {
    return [{ line: 1, rule: "empty-file", message: "O arquivo está vazio." }];
  }

  const lineAt = buildLineLookup(source);
  const errors = [];
  const report = (index, rule, message) =>
    errors.push({ line: lineAt(index), rule, message });

  const s = scrub(source, report);
  const n = s.length;
  let pos = 0;

  function checkStatement(text, start, depth, terminator) {
    if (depth === 0) {
      if (text.startsWith("@")) {
        if (terminator !== ";") {
          report(start, "missing-semicolon", `Regra @ sem ";" no final: "${shorten(text)}".`);
        }
      } else {
        report(start, "invalid-statement", `Texto fora de qualquer regra: "${shorten(text)}".`);
      }
      return;
    }
    if (text.startsWith("@")) return;

    const match = DECLARATION.exec(text);
    if (!match) {
      report(start, "invalid-declaration", `Declaração inválida (esperado "propriedade: valor"): "${shorten(text)}".`);
      return;
    }

    const property = match[1];
    const value = match[2].trim();
    const isCustom = property.startsWith("--");

    if (value === "" && !isCustom) {
      report(start, "invalid-declaration", `A propriedade "${property}" está sem valor.`);
      return;
    }
    if (!isCustom && /\n\s*[a-zA-Z-]+\s*:\s*\S/.test(value)) {
      report(start, "missing-semicolon", `Provável ";" faltando depois de "${property}: …".`);
    }
    for (const hex of value.replace(/url\([^)]*\)/gi, "").matchAll(/#([0-9A-Za-z]+)/g)) {
      if (!HEX_COLOR.test(hex[1])) {
        report(start, "invalid-color", `Cor hexadecimal inválida: #${hex[1]}.`);
      }
    }
  }

  function parseBlock(depth, openIndex) {
    for (;;) {
      while (pos < n && WHITESPACE.test(s[pos])) pos++;

      if (pos >= n) {
        if (depth > 0) report(openIndex, "unclosed-brace", 'Bloco "{" sem o "}" correspondente.');
        return;
      }

      if (s[pos] === "}") {
        if (depth === 0) {
          report(pos, "unexpected-brace", 'Chave "}" sem "{" correspondente.');
          pos++;
          continue;
        }
        pos++;
        return;
      }

      const start = pos;
      let paren = 0;
      while (pos < n) {
        const c = s[pos];
        if (c === "(" || c === "[") {
          paren++;
        } else if (c === ")" || c === "]") {
          if (paren > 0) paren--;
          else report(pos, "unbalanced-paren", `"${c}" sem abertura correspondente.`);
        } else if (paren === 0 && (c === ";" || c === "{" || c === "}")) {
          break;
        }
        pos++;
      }

      const text = s.slice(start, pos).trim();

      if (paren > 0) {
        report(start, "unclosed-paren", 'Parêntese "(" sem o ")" correspondente.');
        continue;
      }

      const terminator = s[pos];
      if (terminator === "{") {
        if (text === "") {
          report(pos, "empty-selector", "Bloco { } sem seletor.");
        } else if (/^@(import|charset|namespace)\b/i.test(text)) {
          report(start, "missing-semicolon", `@${/^@(\w+)/.exec(text)[1].toLowerCase()} termina com ";" e não pode abrir um bloco: "${shorten(text)}".`);
        } else if (/(^|,)\s*$/.test(text) || /^\s*,/.test(text)) {
          report(start, "invalid-selector", `Seletor com vírgula sobrando: "${shorten(text)}".`);
        }
        pos++;
        parseBlock(depth + 1, pos - 1);
      } else {
        if (text !== "") checkStatement(text, start, depth, terminator);
        if (terminator === ";") pos++;
      }
    }
  }

  parseBlock(0, 0);
  return errors.sort((a, b) => a.line - b.line);
}

module.exports = { lintCss };
