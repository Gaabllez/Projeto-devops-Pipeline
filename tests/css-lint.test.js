"use strict";

/**
 * Testes de regressão do validador de CSS.
 * Cada caso é um defeito que passava despercebido pela pipeline original.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { lintCss } = require("../scripts/lib/css-lint");

const VALID = `
:root { color: #172033; background: #f3f6fb; }
.card { padding: 1.5rem; border: 1px solid #dbe3ef; box-shadow: 0 8px 24px rgb(15 23 42 / 6%); }
`;

const rules = (source) => lintCss(source).map((e) => e.rule);

test("um CSS válido não gera erros", () => {
  assert.deepEqual(lintCss(VALID), []);
});

// [descrição, CSS com o defeito, regra que deve disparar]
const defects = [
  // Defeito que passava despercebido na pipeline original (chaves quebradas)
  ["chaves quebradas (}}}{{)", ".hero { padding: 4rem; }}}{{ text-align: center; }", "unexpected-brace"],

  ["bloco sem fechar", ".a { color: red;", "unclosed-brace"],
  ["} sobrando", ".a { color: red; } }", "unexpected-brace"],
  ["bloco sem seletor", "{ color: red; }", "empty-selector"],
  ["seletor com vírgula sobrando", "a, { color: red; }", "invalid-selector"],
  ["comentário sem */", ".a { color: red; } /* aberto", "unterminated-comment"],
  ["texto entre aspas sem fechar", '.a { content: "aberto; }', "unterminated-string"],
  ["declaração sem dois-pontos", ".a { color red; }", "invalid-declaration"],
  ["propriedade sem valor", ".a { color: ; }", "invalid-declaration"],
  ["cor hexadecimal inválida (5 dígitos)", ".a { color: #12345; }", "invalid-color"],
  ["cor hexadecimal com letra inválida", ".a { color: #12g; }", "invalid-color"],
  ["; faltando entre declarações", ".a {\n  color: red\n  background: blue;\n}", "missing-semicolon"],
  ["declaração fora de regra", "color: red;", "invalid-statement"],
  ["texto solto no fim do arquivo", ".a { color: red; }\nsolto", "invalid-statement"],
  ["parêntese sem fechar", ".a { width: calc(1px + 2px; }", "unclosed-paren"],
  ["parêntese de fechamento sobrando", ".a { width: calc(1px + 2px)); }", "unbalanced-paren"],
  ["@import sem ;", '@import "a.css"\n.a { color: red; }', "missing-semicolon"],
];

for (const [description, css, expectedRule] of defects) {
  test(`detecta: ${description}`, () => {
    const found = rules(css);
    assert.ok(
      found.includes(expectedRule),
      `esperava a regra "${expectedRule}", mas o validador retornou: [${found.join(", ")}]`
    );
  });
}

test("arquivo vazio é erro", () => {
  assert.deepEqual(rules(""), ["empty-file"]);
  assert.deepEqual(rules("  \n "), ["empty-file"]);
});

test("informa a linha correta do erro", () => {
  const erro = lintCss(".a {\n  color: red;\n}\n\n.b { color red; }\n").find((e) => e.rule === "invalid-declaration");
  assert.equal(erro.line, 5);
});

// Evita falsos positivos: CSS válido, mas menos comum, não pode ser reprovado.
const validVariants = [
  ["@media com regras dentro", "@media (max-width: 600px) { .a { color: red; } .b { margin: 0; } }"],
  ["@import e @charset", '@charset "utf-8";\n@import url("a.css");\n.a { color: red; }'],
  ["propriedades personalizadas (--x)", ":root { --cor: #fff; --vazio:; } .a { color: var(--cor); }"],
  ["última declaração sem ;", ".a { color: red }"],
  ["!important", ".a { color: red !important; }"],
  ["comentário com { } ; dentro", ".a { /* { } ; ( */ color: red; }"],
  ["string com { } ; dentro", '.a::after { content: "{ } ; ("; }'],
  ["url(data:...) com ; dentro", ".a { background: url(data:image/png;base64,AAAA=); }"],
  ["cor hexadecimal de 3, 4, 6 e 8 dígitos", ".a { color: #fff; background: #ffff; border-color: #ffffff; outline-color: #ffffffff; }"],
  ["#id em seletor e url(#fragmento)", "#menu { fill: url(#grad); }"],
  ["seletores com : e [] e >", "a:hover, input[type=\"text\"] > span::before { color: red; }"],
  ["CSS aninhado", ".card { color: red; & .title { color: blue; } }"],
  ["@font-face e @keyframes", "@font-face { font-family: X; src: url(x.woff2); }\n@keyframes a { from { opacity: 0; } to { opacity: 1; } }"],
  ["quebras de linha CRLF", VALID.replace(/\n/g, "\r\n")],
  ["BOM no início do arquivo", `﻿${VALID}`],
];

for (const [description, css] of validVariants) {
  test(`aceita (sem falso positivo): ${description}`, () => {
    assert.deepEqual(lintCss(css), []);
  });
}
