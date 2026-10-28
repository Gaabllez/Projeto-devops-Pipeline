"use strict";

/**
 * Validador de HTML sem dependências.
 *
 * Não substitui o validador oficial do W3C, mas pega os erros que realmente
 * quebram um site: tags mal fechadas ou mal aninhadas, atributos quebrados e
 * falta de elementos essenciais (doctype, lang, charset, viewport, title,
 * main, h1). Todas as tags não-void precisam de fechamento explícito.
 *
 * Uso:
 *   const { lintHtml } = require("./html-lint");
 *   const erros = lintHtml(codigoHtml); // [{ line, rule, message }]
 */

const { buildLineLookup } = require("./lines");

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "source", "track", "wbr",
]);

// Elementos cujo conteúdo é texto puro (não contém tags).
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

const DEPRECATED_ELEMENTS = new Set([
  "acronym", "applet", "basefont", "big", "blink", "center", "dir",
  "font", "frame", "frameset", "marquee", "noframes", "strike", "tt",
]);

const HEADING = /^h([1-6])$/;
const LANG_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const WHITESPACE = /\s/;

/** Texto de um elemento e de todos os seus descendentes. */
function textContent(element) {
  return element.text + element.children.map(textContent).join("");
}

/**
 * Lê o HTML e monta a árvore de elementos.
 * Retorna { root, elements, errors, doctype }. `elements` está na ordem do documento.
 */
function parseHtml(source) {
  const lineAt = buildLineLookup(source);
  const errors = [];
  const report = (index, rule, message) =>
    errors.push({ line: lineAt(index), rule, message });

  const root = {
    name: "#document", attrs: Object.create(null), children: [],
    text: "", index: 0, parent: null,
  };
  const elements = [];
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const n = source.length;

  let doctype = null;
  let seenContent = false; // já apareceu algo além de espaços e comentários
  let i = 0;

  function closeElement(name, index) {
    let j = stack.length - 1;
    while (j >= 1 && stack[j].name !== name) j--;
    if (j < 1) {
      report(index, "unexpected-end-tag", `</${name}> não tem tag de abertura correspondente.`);
      return;
    }
    if (j === stack.length - 1) {
      stack.pop();
      return;
    }
    const inner = top();
    report(
      index,
      "mismatched-end-tag",
      `</${name}> encontrada, mas <${inner.name}> (aberta na linha ${lineAt(inner.index)}) ainda não foi fechada.`
    );
    stack.length = j;
  }

  outer: while (i < n) {
    // --- texto ---------------------------------------------------------
    if (source[i] !== "<") {
      const next = source.indexOf("<", i);
      const end = next === -1 ? n : next;
      const text = source.slice(i, end);
      if (text.trim() !== "" && !seenContent) {
        report(i, "doctype", "Há texto antes do <!DOCTYPE html>.");
        seenContent = true;
      }
      top().text += text;
      i = end;
      continue;
    }

    // --- comentário ----------------------------------------------------
    if (source.startsWith("<!--", i)) {
      const close = source.indexOf("-->", i + 4);
      if (close === -1) {
        report(i, "unterminated-comment", "Comentário <!-- sem o --> de fechamento.");
        break;
      }
      i = close + 3;
      continue;
    }

    // --- doctype -------------------------------------------------------
    if (/^<!doctype/i.test(source.slice(i, i + 9))) {
      const close = source.indexOf(">", i);
      if (close === -1) {
        report(i, "doctype", "<!DOCTYPE sem o > de fechamento.");
        break;
      }
      const declaration = source.slice(i, close + 1);
      if (seenContent) {
        report(i, "doctype", "O <!DOCTYPE html> deve ser a primeira declaração do arquivo.");
      } else if (!/^<!doctype\s+html\s*>$/i.test(declaration)) {
        report(i, "doctype", `DOCTYPE inválido: use <!DOCTYPE html> (encontrado: ${declaration}).`);
      }
      doctype = doctype || declaration;
      seenContent = true;
      i = close + 1;
      continue;
    }

    // --- outras declarações <! ou <? ------------------------------------
    if (source[i + 1] === "!" || source[i + 1] === "?") {
      report(i, "malformed-tag", `Declaração não suportada: ${source.slice(i, i + 12)}…`);
      const close = source.indexOf(">", i);
      i = close === -1 ? n : close + 1;
      continue;
    }

    // --- tag de fechamento ---------------------------------------------
    if (source[i + 1] === "/") {
      seenContent = true;
      const endTag = /<\/([a-zA-Z][^\s>/]*)\s*>/y;
      endTag.lastIndex = i;
      const match = endTag.exec(source);
      if (!match) {
        report(i, "malformed-tag", "Tag de fechamento malformada.");
        const close = source.indexOf(">", i);
        i = close === -1 ? n : close + 1;
        continue;
      }
      const name = match[1].toLowerCase();
      if (VOID_ELEMENTS.has(name)) {
        report(i, "void-end-tag", `<${name}> não tem tag de fechamento; remova </${name}>.`);
      } else {
        closeElement(name, i);
      }
      i += match[0].length;
      continue;
    }

    // --- tag de abertura -----------------------------------------------
    const startTag = /<([a-zA-Z][^\s>/]*)/y;
    startTag.lastIndex = i;
    const nameMatch = startTag.exec(source);
    if (!nameMatch) {
      report(i, "malformed-tag", 'Caractere "<" solto no texto; use &lt; para exibir o símbolo.');
      i++;
      continue;
    }

    seenContent = true;
    const name = nameMatch[1].toLowerCase();
    let pos = i + nameMatch[0].length;
    const attrs = Object.create(null);
    let selfClosing = false;
    let closed = false;

    while (pos < n) {
      while (pos < n && WHITESPACE.test(source[pos])) pos++;
      if (pos >= n) break;

      if (source[pos] === ">") {
        pos++;
        closed = true;
        break;
      }
      if (source[pos] === "/" && source[pos + 1] === ">") {
        selfClosing = true;
        closed = true;
        pos += 2;
        break;
      }

      // Um "<" aqui significa que o ">" da tag atual foi esquecido.
      if (source[pos] === "<") {
        report(i, "unterminated-tag", `A tag <${name}> não foi terminada com ">" antes da próxima tag.`);
        i = pos;
        continue outer;
      }

      const attrName = /[^\s"'<>/=]+/y;
      attrName.lastIndex = pos;
      const a = attrName.exec(source);
      if (!a) {
        report(pos, "malformed-tag", `Caractere inesperado "${source[pos]}" dentro de <${name}>.`);
        pos++;
        continue;
      }
      const key = a[0].toLowerCase();
      pos += a[0].length;

      if (key in attrs) {
        report(pos, "duplicate-attribute", `Atributo "${key}" repetido em <${name}>.`);
      }

      let value = ""; // atributo booleano (ex.: <input disabled>)
      let p = pos;
      while (p < n && WHITESPACE.test(source[p])) p++;
      if (source[p] === "=") {
        p++;
        while (p < n && WHITESPACE.test(source[p])) p++;
        const quote = source[p];
        if (quote === '"' || quote === "'") {
          const endQuote = source.indexOf(quote, p + 1);
          if (endQuote === -1) {
            report(p, "unterminated-attribute", `Aspas sem fechamento no atributo "${key}" de <${name}>.`);
            break outer;
          }
          value = source.slice(p + 1, endQuote);
          pos = endQuote + 1;
        } else {
          const bare = /[^\s"'=<>`]+/y;
          bare.lastIndex = p;
          const v = bare.exec(source);
          if (!v) {
            report(p, "malformed-tag", `Atributo "${key}" sem valor depois do "=".`);
            pos = p;
          } else {
            value = v[0];
            pos = p + v[0].length;
          }
        }
      }
      if (!(key in attrs)) attrs[key] = value;
    }

    if (!closed) {
      report(i, "unterminated-tag", `A tag <${name}> não foi terminada com ">".`);
      break;
    }

    const element = { name, attrs, index: i, children: [], text: "", parent: top() };
    top().children.push(element);
    elements.push(element);

    if (VOID_ELEMENTS.has(name)) {
      i = pos;
      continue;
    }
    if (selfClosing) {
      report(i, "self-closing", `<${name} /> não é válido em HTML; use <${name}></${name}>.`);
      i = pos;
      continue;
    }

    stack.push(element);

    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closing = new RegExp(`</${name}\\s*>`, "ig");
      closing.lastIndex = pos;
      const found = closing.exec(source);
      if (!found) {
        report(i, "unclosed-element", `<${name}> sem o </${name}> correspondente.`);
        stack.pop();
        break;
      }
      element.text = source.slice(pos, found.index);
      i = found.index; // a tag de fechamento é processada na próxima volta
      continue;
    }

    i = pos;
  }

  for (let k = stack.length - 1; k >= 1; k--) {
    report(stack[k].index, "unclosed-element", `<${stack[k].name}> nunca foi fechada.`);
  }

  return { root, elements, errors, doctype };
}

/** Valida o HTML e devolve a lista de erros ordenada por linha. */
function lintHtml(source) {
  if (source.trim() === "") {
    return [{ line: 1, rule: "empty-file", message: "O arquivo está vazio." }];
  }

  const { root, elements, errors, doctype } = parseHtml(source);
  const lineAt = buildLineLookup(source);
  const add = (element, rule, message) =>
    errors.push({ line: element ? lineAt(element.index) : 1, rule, message });

  if (!doctype) add(null, "doctype", "Falta <!DOCTYPE html> no início do arquivo.");

  // Estrutura geral: <html> > <head> + <body>
  const rootElements = root.children;
  const htmls = rootElements.filter((e) => e.name === "html");
  if (htmls.length !== 1 || rootElements.length !== 1) {
    add(rootElements[0], "html-structure", "O documento deve ter exatamente um elemento <html> na raiz.");
  }
  const html = htmls[0];
  const head = elements.find((e) => e.name === "head");
  const body = elements.find((e) => e.name === "body");
  if (html) {
    const kids = html.children.map((c) => c.name).join(", ");
    if (kids !== "head, body") {
      add(html, "html-structure", `O <html> deve conter <head> e <body>, nesta ordem (encontrado: ${kids || "nada"}).`);
    }
    const lang = html.attrs.lang;
    if (lang === undefined || lang.trim() === "") {
      add(html, "html-lang", 'O <html> precisa do atributo lang (ex.: lang="pt-BR").');
    } else if (!LANG_PATTERN.test(lang)) {
      add(html, "html-lang", `Valor de lang inválido: "${lang}".`);
    }
  }

  // <head>: charset, viewport, title
  const headChildren = (name) =>
    elements.filter((e) => e.name === name && e.parent && e.parent.name === "head");
  const metas = headChildren("meta");

  const charset = metas.find((m) => "charset" in m.attrs);
  if (!charset) {
    add(head, "meta-charset", 'Falta <meta charset="UTF-8"> dentro do <head>.');
  } else if (charset.attrs.charset.trim().toLowerCase() !== "utf-8") {
    add(charset, "meta-charset", `O charset deve ser UTF-8 (encontrado: "${charset.attrs.charset}").`);
  }

  const viewport = metas.find((m) => (m.attrs.name || "").toLowerCase() === "viewport");
  if (!viewport || (viewport.attrs.content || "").trim() === "") {
    add(head, "meta-viewport", 'Falta <meta name="viewport" content="..."> (necessário para páginas responsivas).');
  }

  const titles = elements.filter((e) => e.name === "title");
  if (titles.length === 0) {
    add(head, "title", "Falta o elemento <title>.");
  } else {
    if (titles.length > 1) add(titles[1], "title", "A página tem mais de um <title>.");
    if (titles[0].text.trim() === "") add(titles[0], "title", "O <title> está vazio.");
    if (titles[0].parent.name !== "head") add(titles[0], "title", "O <title> deve ficar dentro do <head>.");
  }

  // <body>: um <main> e um <h1>
  const mains = elements.filter((e) => e.name === "main");
  if (mains.length === 0) {
    add(body, "main", "Falta o elemento <main> com o conteúdo principal.");
  } else if (mains.length > 1) {
    add(mains[1], "main", "Só pode existir um <main> por página.");
  }

  const h1s = elements.filter((e) => e.name === "h1");
  if (h1s.length === 0) {
    add(body, "h1", "Falta o <h1> da página.");
  } else if (h1s.length > 1) {
    add(h1s[1], "h1", "Use apenas um <h1> por página.");
  } else if (textContent(h1s[0]).trim() === "") {
    add(h1s[0], "h1", "O <h1> está vazio.");
  }

  // Hierarquia de títulos: começa em h1 e não pula níveis
  let previous = 0;
  for (const element of elements) {
    const match = HEADING.exec(element.name);
    if (!match) continue;
    const level = Number(match[1]);
    if (previous === 0 && level !== 1) {
      add(element, "heading-order", `O primeiro título da página deve ser <h1> (encontrado: <${element.name}>).`);
    } else if (previous !== 0 && level > previous + 1) {
      add(element, "heading-order", `Salto de <h${previous}> para <${element.name}>; não pule níveis de título.`);
    }
    previous = level;
  }

  // Regras por elemento
  const ids = new Map();
  for (const element of elements) {
    if ("id" in element.attrs) {
      const id = element.attrs.id;
      if (id.trim() === "") {
        add(element, "id", `O atributo id de <${element.name}> está vazio.`);
      } else if (WHITESPACE.test(id)) {
        add(element, "id", `O id "${id}" não pode conter espaços.`);
      } else if (ids.has(id)) {
        add(element, "duplicate-id", `O id "${id}" já foi usado na linha ${lineAt(ids.get(id).index)}.`);
      } else {
        ids.set(id, element);
      }
    }
    if (element.name === "img" && !("alt" in element.attrs)) {
      add(element, "img-alt", "<img> sem atributo alt (use alt=\"\" se a imagem for decorativa).");
    }
    if (DEPRECATED_ELEMENTS.has(element.name)) {
      add(element, "deprecated-element", `<${element.name}> é obsoleto; use CSS no lugar.`);
    }
    if (element.name === "li" && !["ul", "ol", "menu"].includes(element.parent.name)) {
      add(element, "list-structure", "<li> deve estar dentro de <ul>, <ol> ou <menu>.");
    }
  }

  return errors.sort((a, b) => a.line - b.line);
}

module.exports = { parseHtml, lintHtml, textContent };
