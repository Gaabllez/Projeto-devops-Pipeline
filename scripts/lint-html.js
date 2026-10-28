#!/usr/bin/env node
"use strict";

const { lintHtml } = require("./lib/html-lint");
const { runLint } = require("./lib/run-lint");

// Sem argumentos valida public/**/*.html; ou passe arquivos/pastas como argumento.
process.exitCode = runLint({ label: "Validação de HTML", extension: ".html", lint: lintHtml });
