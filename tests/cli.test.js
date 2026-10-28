"use strict";

/**
 * Testes dos comandos `npm run lint:html` e `npm run lint:css`.
 * O que importa para a pipeline é o código de saída: 0 passa, diferente de 0 reprova.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPTS = path.join(__dirname, "..", "scripts");
const GOOD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>T</title></head>
<body><h1>Oi</h1><main><p>x</p></main></body>
</html>
`;

function run(script, ...args) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function withTempDir(files, callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    callback(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("lint:html e lint:css passam no site real (public/)", () => {
  assert.equal(run("lint-html.js").status, 0);
  assert.equal(run("lint-css.js").status, 0);
});

test("lint:html retorna 0 para HTML válido", () => {
  withTempDir({ "ok.html": GOOD_HTML }, (dir) => {
    assert.equal(run("lint-html.js", dir).status, 0);
  });
});

test("lint:html retorna 1 e aponta arquivo, linha e regra quando há erro", () => {
  withTempDir({ "ruim.html": GOOD_HTML.replace("<main>", "<div>").replace("</main>", "</div>") }, (dir) => {
    const result = run("lint-html.js", dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ruim\.html:\d+ {2}\[main\]/);
  });
});

test("lint:css retorna 0 para CSS válido e 1 para CSS quebrado", () => {
  withTempDir({ "ok.css": "a { color: red; }" }, (dir) => {
    assert.equal(run("lint-css.js", dir).status, 0);
  });
  withTempDir({ "ruim.css": "a { color: red; }}}{{" }, (dir) => {
    const result = run("lint-css.js", dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ruim\.css:1 {2}\[unexpected-brace\]/);
  });
});

test("a validação falha (em vez de passar em branco) se não houver nenhum arquivo", () => {
  withTempDir({}, (dir) => {
    assert.equal(run("lint-html.js", dir).status, 1);
    assert.equal(run("lint-css.js", dir).status, 1);
  });
});

test("a validação falha se o caminho não existir", () => {
  assert.equal(run("lint-html.js", path.join(os.tmpdir(), "nao-existe-xyz")).status, 1);
});

test("um erro em qualquer arquivo reprova o conjunto", () => {
  withTempDir({ "a.html": GOOD_HTML, "b.html": "<p>sem nada</p>" }, (dir) => {
    assert.equal(run("lint-html.js", dir).status, 1);
  });
});
