"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_TARGET = path.join(ROOT, "public");

const relative = (file) => path.relative(process.cwd(), file) || file;

/** Lista, recursivamente, os arquivos com a extensão pedida. */
function collectFiles(target, extension) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(extension) ? [target] : [];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) return collectFiles(full, extension);
    return full.endsWith(extension) ? [full] : [];
  });
}

/**
 * Executa um linter nos arquivos indicados (ou em public/ por padrão).
 * Devolve o código de saída: 0 = tudo certo, 1 = erros encontrados.
 */
function runLint({ label, extension, lint, args = process.argv.slice(2) }) {
  const targets = args.length > 0 ? args.map((a) => path.resolve(a)) : [DEFAULT_TARGET];
  const files = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.error(`ERRO: caminho não encontrado: ${relative(target)}`);
      return 1;
    }
    files.push(...collectFiles(target, extension));
  }

  // Sem isso, mover ou apagar o site faria a validação "passar" sem validar nada.
  if (files.length === 0) {
    console.error(`ERRO: nenhum arquivo ${extension} encontrado em ${targets.map(relative).join(", ")}.`);
    return 1;
  }

  let total = 0;
  for (const file of files) {
    const errors = lint(fs.readFileSync(file, "utf8"));
    if (errors.length === 0) {
      console.log(`OK: ${relative(file)}`);
      continue;
    }
    total += errors.length;
    for (const { line, rule, message } of errors) {
      console.error(`${relative(file)}:${line}  [${rule}]  ${message}`);
    }
  }

  if (total > 0) {
    console.error(`\n${label}: ${total} erro(s) em ${files.length} arquivo(s).`);
    return 1;
  }
  console.log(`${label}: ${files.length} arquivo(s) validado(s) sem erros.`);
  return 0;
}

module.exports = { runLint, collectFiles };
