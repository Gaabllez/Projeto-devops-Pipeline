#!/usr/bin/env node
"use strict";

const { lintCss } = require("./lib/css-lint");
const { runLint } = require("./lib/run-lint");

// Sem argumentos valida public/**/*.css; ou passe arquivos/pastas como argumento.
process.exitCode = runLint({ label: "Validação de CSS", extension: ".css", lint: lintCss });
