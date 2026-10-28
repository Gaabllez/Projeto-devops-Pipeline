"use strict";

/**
 * Testes de regressão do validador de HTML.
 * Cada caso abaixo é um defeito real que já passou despercebido pela pipeline:
 * se o validador parar de pegá-lo, estes testes falham.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { lintHtml } = require("../scripts/lib/html-lint");

const HEAD = `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página de teste</title>
  <link rel="stylesheet" href="style.css">`;

const BODY = `  <h1>Título</h1>
  <main>
    <section><h2>Seção</h2><p>Texto.</p></section>
  </main>`;

function page({ doctype = "<!DOCTYPE html>", htmlAttrs = ' lang="pt-BR"', head = HEAD, body = BODY } = {}) {
  return `${doctype}\n<html${htmlAttrs}>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

const rules = (source) => lintHtml(source).map((e) => e.rule);

test("uma página válida não gera erros", () => {
  assert.deepEqual(lintHtml(page()), []);
});

// [descrição, HTML com o defeito, regra que deve disparar]
const defects = [
  // Os 4 defeitos que passavam despercebidos na pipeline original
  ["h1 removido", page({ body: BODY.replace("<h1>Título</h1>", "") }), "h1"],
  ["tag de fechamento errada (</section> -> </span>)", page({ body: BODY.replace("</section>", "</span>") }), "unexpected-end-tag"],
  ["<section> nunca fechada", page({ body: BODY.replace("</section>", "") }), "mismatched-end-tag"],
  ["</html> final esquecido", page().replace("</html>", ""), "unclosed-element"],
  ["<main> removido", page({ body: BODY.replace(/<\/?main>/g, "") }), "main"],

  // Estrutura do documento
  ["arquivo sem DOCTYPE", page({ doctype: "" }), "doctype"],
  ["DOCTYPE antigo (HTML 4)", page({ doctype: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">' }), "doctype"],
  ["texto antes do DOCTYPE", `lixo\n${page()}`, "doctype"],
  ["<html> sem lang", page({ htmlAttrs: "" }), "html-lang"],
  ["lang inválido", page({ htmlAttrs: ' lang="português do brasil"' }), "html-lang"],
  ["<head> sem charset", page({ head: HEAD.replace('<meta charset="UTF-8">', "") }), "meta-charset"],
  ["charset diferente de UTF-8", page({ head: HEAD.replace("UTF-8", "ISO-8859-1") }), "meta-charset"],
  ["<head> sem viewport", page({ head: HEAD.replace(/<meta name="viewport"[^>]*>/, "") }), "meta-viewport"],
  ["sem <title>", page({ head: HEAD.replace(/<title>.*<\/title>/, "") }), "title"],
  ["<title> vazio", page({ head: HEAD.replace("Página de teste", "") }), "title"],
  ["dois <main>", page({ body: `${BODY}\n<main><p>outro</p></main>` }), "main"],
  ["<head> e <body> fora de ordem", "<!DOCTYPE html>\n<html lang=\"pt-BR\"><body><h1>x</h1><main></main></body><head></head></html>", "html-structure"],

  // Títulos
  ["<h1> vazio", page({ body: BODY.replace("<h1>Título</h1>", "<h1>  </h1>") }), "h1"],
  ["dois <h1>", page({ body: `${BODY}\n<h1>Outro</h1>` }), "h1"],
  ["salto de h1 para h3", page({ body: BODY.replace("<h2>", "<h3>").replace("</h2>", "</h3>") }), "heading-order"],
  ["página começando em h2", page({ body: BODY.replace("<h1>Título</h1>", "<h2>Título</h2>") }), "heading-order"],

  // Aninhamento e fechamento
  ["tags cruzadas (<div><p></div></p>)", page({ body: `${BODY}\n<div><p>x</div></p>` }), "mismatched-end-tag"],
  ["</br> (void com fechamento)", page({ body: `${BODY}\n<p>a</br>b</p>` }), "void-end-tag"],
  ["<div /> autofechada", page({ body: `${BODY}\n<div />` }), "self-closing"],
  ["<li> fora de lista", page({ body: `${BODY}\n<li>solto</li>` }), "list-structure"],

  // Atributos
  ["aspas sem fechar em atributo", page({ body: `${BODY}\n<a href="x>link</a>` }), "unterminated-attribute"],
  ["atributo repetido", page({ body: `${BODY}\n<p class="a" class="b">x</p>` }), "duplicate-attribute"],
  ["id duplicado", page({ body: `${BODY}\n<p id="a">1</p><p id="a">2</p>` }), "duplicate-id"],
  ["id com espaço", page({ body: `${BODY}\n<p id="a b">1</p>` }), "id"],
  ["<img> sem alt", page({ body: `${BODY}\n<img src="a.png">` }), "img-alt"],
  ["tag sem o > final", page({ body: `${BODY}\n<p class="a"` }), "unterminated-tag"],
  ["< solto no texto", page({ body: `${BODY}\n<p>3 < 5</p>` }), "malformed-tag"],

  // Outros
  ["elemento obsoleto <center>", page({ body: `${BODY}\n<center>x</center>` }), "deprecated-element"],
  ["comentário sem -->", page({ body: `${BODY}\n<!-- aberto` }), "unterminated-comment"],
  ["<script> sem fechamento", page({ body: `${BODY}\n<script>var a = 1;` }), "unclosed-element"],
];

for (const [description, html, expectedRule] of defects) {
  test(`detecta: ${description}`, () => {
    const found = rules(html);
    assert.ok(
      found.includes(expectedRule),
      `esperava a regra "${expectedRule}", mas o validador retornou: [${found.join(", ")}]`
    );
  });
}

test("arquivo vazio é erro", () => {
  assert.deepEqual(rules(""), ["empty-file"]);
  assert.deepEqual(rules("   \n  "), ["empty-file"]);
});

test("informa a linha correta do erro", () => {
  const source = page({ body: `${BODY}\n<p>ok</p>\n<img src="a.png">\n<p>ok</p>` });
  const erro = lintHtml(source).find((e) => e.rule === "img-alt");
  const linhaEsperada = source.split("\n").findIndex((l) => l.includes("<img")) + 1;
  assert.equal(erro.line, linhaEsperada);
});

test("tag não fechada: a mensagem aponta a linha onde ela foi aberta", () => {
  const source = page({ body: BODY.replace("</section>", "") });
  const erro = lintHtml(source).find((e) => e.rule === "mismatched-end-tag");
  const linhaAberta = source.split("\n").findIndex((l) => l.includes("<section>")) + 1;
  assert.match(erro.message, new RegExp(`<section> \\(aberta na linha ${linhaAberta}\\)`));
});

// Evita falsos positivos: HTML válido, mas "esquisito", não pode ser reprovado.
const validVariants = [
  ["tags e atributos em maiúsculas", page().replace(/<(\/?)(h1|main|section)/g, (_, s, t) => `<${s}${t.toUpperCase()}`).replace("</H1>", "</H1>")],
  ["atributos com aspas simples, sem aspas e booleanos", page({ body: `${BODY}\n<input type=text value='a' disabled>` })],
  ["elementos void com e sem barra", page({ body: `${BODY}\n<br><br/><hr /><img src="a.png" alt="">` })],
  ["comentário com tags dentro", page({ body: `${BODY}\n<!-- <div> <p> sem fechar -->` })],
  ["<script> com tags e sinais dentro", page({ body: `${BODY}\n<script>if (1 < 2 && "<div>") { document.write("</p>"); }</script>` })],
  ["<style> com > e chaves", page({ head: `${HEAD}\n<style>main > section { color: red; }</style>` })],
  ["entidades HTML no texto", page({ body: `${BODY}\n<p>5 &lt; 7 &amp; 8 &gt; 2</p>` })],
  ["quebras de linha CRLF", page().replace(/\n/g, "\r\n")],
  ["BOM no início do arquivo", `﻿${page()}`],
  ["lang com variante regional", page({ htmlAttrs: ' lang="en-US"' })],
];

for (const [description, html] of validVariants) {
  test(`aceita (sem falso positivo): ${description}`, () => {
    assert.deepEqual(lintHtml(html), []);
  });
}
