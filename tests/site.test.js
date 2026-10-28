"use strict";

/**
 * Testes de conteúdo do site publicado (pasta public/).
 * Verificam o que o site É, não a sintaxe (isso é papel do lint).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseHtml, textContent } = require("../scripts/lib/html-lint");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const read = (file) => fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8");

const { elements } = parseHtml(read("index.html"));
const byName = (name) => elements.filter((e) => e.name === name);

// Link ou arquivo local (ignora http://, https://, //cdn, mailto:, tel:, data: e âncoras #)
const isLocal = (url) => url !== "" && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);

test("public/ contém index.html e style.css não vazios", () => {
  for (const file of ["index.html", "style.css"]) {
    const full = path.join(PUBLIC_DIR, file);
    assert.ok(fs.existsSync(full), `${file} não existe em public/`);
    assert.ok(fs.statSync(full).size > 0, `${file} está vazio`);
  }
});

test("a página está em português do Brasil", () => {
  assert.equal(byName("html")[0].attrs.lang, "pt-BR");
});

test("a página tem título, descrição e um único h1 com texto", () => {
  assert.notEqual(byName("title")[0].text.trim(), "", "o <title> está vazio");

  const description = byName("meta").find((m) => m.attrs.name === "description");
  assert.ok(description && description.attrs.content.trim() !== "", "falta <meta name=\"description\">");

  const h1s = byName("h1");
  assert.equal(h1s.length, 1, "deve haver exatamente um <h1>");
  assert.notEqual(textContent(h1s[0]).trim(), "", "o <h1> está vazio");
});

test("o <main> tem seções e cada seção tem um título h2 com conteúdo", () => {
  const main = byName("main")[0];
  const sections = main.children.filter((c) => c.name === "section");
  assert.ok(sections.length >= 1, "o <main> deve ter ao menos uma <section>");

  for (const section of sections) {
    const h2 = section.children.find((c) => c.name === "h2");
    assert.ok(h2, "toda <section> deve começar com um <h2>");
    assert.notEqual(textContent(h2).trim(), "", "há um <h2> vazio");
    assert.ok(textContent(section).trim().length > textContent(h2).trim().length, "há uma seção sem conteúdo além do título");
  }
});

test("a página referencia uma folha de estilos e ela existe", () => {
  const stylesheets = byName("link").filter((l) => (l.attrs.rel || "").toLowerCase() === "stylesheet");
  assert.ok(stylesheets.length >= 1, "nenhuma folha de estilos referenciada");

  for (const link of stylesheets) {
    if (!isLocal(link.attrs.href)) continue;
    const file = path.join(PUBLIC_DIR, link.attrs.href.split(/[?#]/)[0]);
    assert.ok(fs.existsSync(file), `a folha de estilos "${link.attrs.href}" não existe em public/`);
  }
});

test("todos os arquivos locais referenciados (link, script, img) existem", () => {
  const references = [
    ...byName("link").map((e) => e.attrs.href),
    ...byName("script").map((e) => e.attrs.src),
    ...byName("img").map((e) => e.attrs.src),
  ].filter((url) => url !== undefined && isLocal(url));

  for (const url of references) {
    const file = path.join(PUBLIC_DIR, url.split(/[?#]/)[0]);
    assert.ok(fs.existsSync(file), `"${url}" é referenciado em index.html mas não existe em public/`);
  }
});

test("links de âncora (#id) apontam para um id que existe na página", () => {
  const ids = new Set(elements.filter((e) => "id" in e.attrs).map((e) => e.attrs.id));
  for (const a of byName("a")) {
    const href = a.attrs.href || "";
    if (href.startsWith("#") && href.length > 1) {
      assert.ok(ids.has(href.slice(1)), `a âncora ${href} não tem um elemento com esse id`);
    }
  }
});

test("as classes de layout usadas no HTML estão definidas no CSS", () => {
  const css = read("style.css");
  const used = new Set(
    elements.flatMap((e) => (e.attrs.class || "").split(/\s+/)).filter(Boolean)
  );
  for (const className of used) {
    assert.ok(
      new RegExp(`\\.${className}(?![\\w-])`).test(css),
      `a classe "${className}" é usada no HTML mas não existe no style.css`
    );
  }
});
