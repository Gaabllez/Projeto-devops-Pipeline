# Projeto DevOps — CI/CD com GitHub Actions

<!-- Troque SEU_USUARIO pelo seu usuário do GitHub (e o nome do repositório, se for diferente). -->
![CI](https://github.com/SEU_USUARIO/projeto-devops-ci-cd/actions/workflows/ci.yml/badge.svg?event=pull_request)
![CD](https://github.com/SEU_USUARIO/projeto-devops-ci-cd/actions/workflows/deploy.yml/badge.svg)

## Sobre
Projeto acadêmico demonstrativo de integração contínua (CI), testes automatizados e publicação contínua (CD) usando GitHub Actions e GitHub Pages.

O site em si é uma página estática simples (`public/`); o foco do projeto é a **pipeline** que valida, testa e publica essa página.

## Tecnologias
- HTML5 e CSS3
- Node.js (validadores e testes, sem dependências externas)
- Git e GitHub
- GitHub Actions
- GitHub Pages

## Estrutura do projeto
```text
.
├── public/                  # o site (é só esta pasta que vai ao ar)
│   ├── index.html
│   └── style.css
├── scripts/
│   ├── lint-html.js         # comando: npm run lint:html
│   ├── lint-css.js          # comando: npm run lint:css
│   └── lib/                 # validadores de HTML e CSS
├── tests/                   # testes automatizados (node:test)
├── .github/
│   ├── dependabot.yml       # mantém as versões das actions atualizadas
│   └── workflows/
│       ├── validate.yml     # fases 1 e 2 (reutilizável)
│       ├── ci.yml           # CI: roda nos Pull Requests
│       └── deploy.yml       # CD: valida e publica no Pages
├── .gitignore
└── package.json
```

## Pipeline
A validação é definida **uma única vez** em `validate.yml` (workflow reutilizável) e chamada pela CI e pela CD.

| Fase | O que faz | Comando local |
|---|---|---|
| 1 | Valida o HTML (estrutura, tags, atributos) e o CSS (sintaxe) | `npm run lint` |
| 2 | Executa os testes automatizados | `npm test` |
| 3 | Publica a pasta `public/` no GitHub Pages (só na CD) | — |

- **`ci.yml`** roda em Pull Requests para `main` e manualmente (aba *Actions → Run workflow*). Executa as fases 1 e 2.
- **`deploy.yml`** roda a cada push na `main` (ou seja, após o merge de um PR) e manualmente. Executa as fases 1 e 2 e, se passarem, a fase 3. Só publica a partir da `main`.

> A CI não roda em push de branches de feature: o Pull Request já a dispara, e rodar nos dois gerava a mesma execução em duplicidade.

### O que a Fase 1 verifica
- **HTML:** `<!DOCTYPE html>`, `lang`, `charset` UTF-8, `viewport`, `<title>` preenchido, um `<main>`, um único `<h1>` e hierarquia de títulos sem saltos; tags fechadas e aninhadas corretamente; atributos sem aspas soltas nem repetidos; `id` únicos; `<img>` com `alt`; elementos obsoletos.
- **CSS:** chaves e parênteses com par, comentários e textos entre aspas fechados, blocos com seletor, declarações no formato `propriedade: valor`, `;` faltando e cores hexadecimais válidas.

### O que a Fase 2 verifica
- **Conteúdo do site:** `public/` com `index.html` e `style.css` não vazios, página em `pt-BR`, título/descrição/`h1` preenchidos, seções com título, todos os arquivos locais referenciados existem (ex.: o link para `style.css`) e as classes usadas no HTML existem no CSS.
- **Os próprios validadores:** há um teste para cada defeito conhecido (h1 removido, tag mal fechada, CSS quebrado, `style.css` apagado etc.) e testes de que HTML/CSS válidos **não** são reprovados. Se alguém enfraquecer um validador, a pipeline avisa.

## Testar localmente
Requer Node.js 22 ou superior (o Node 20 já saiu de suporte).

```bash
npm ci            # instala (não há dependências externas)
npm run lint      # fase 1: valida HTML e CSS
npm test          # fase 2: testes
npm run check     # tudo de uma vez: lint + testes
```

Para ver o site no navegador, abra `public/index.html` ou rode um servidor local:

```bash
python3 -m http.server --directory public 8000   # depois acesse http://localhost:8000
```

Para validar outro arquivo ou pasta: `node scripts/lint-html.js caminho/do/arquivo.html`.

## Fluxo GitFlow para demonstração
1. Criar uma branch de funcionalidade: `git switch -c feature/melhora-site`
2. Fazer uma alteração em `public/index.html` ou `public/style.css`.
3. Conferir localmente: `npm run check`
4. Registrar: `git add .` e `git commit -m "feat: melhora o site"`
5. Enviar: `git push -u origin feature/melhora-site`
6. No GitHub, abrir um Pull Request da branch `feature/melhora-site` para `main` (é o PR que dispara a CI).
7. Conferir se a CI passou.
8. Fazer o merge do Pull Request.
9. Conferir a execução da CD (aba *Actions*) e abrir o site publicado.

### Demonstrar a CI falhando
Em uma branch de teste, estrague o HTML de propósito — por exemplo, apague o `<main>` ou um `</section>` de `public/index.html` — e abra o PR. A Fase 1 deve reprovar apontando o arquivo, a linha e a regra, e o botão de merge fica bloqueado quando a proteção da `main` (abaixo) está ativa.

## Configurar o GitHub Pages
A publicação usa as actions oficiais do GitHub (`upload-pages-artifact` e `deploy-pages`), **sem** a branch `gh-pages`. Antes da primeira execução da CD:

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Dê push na `main` (ou rode a CD manualmente). O endereço do site aparece no resumo da execução e em **Settings → Pages**.

## Proteger a branch `main`
Para que ninguém publique sem passar pela CI:

1. Abra **Settings → Rules → Rulesets** (ou **Branches → Add branch protection rule**) e crie uma regra para a branch `main`.
2. Ative **Require a pull request before merging**.
3. Ative **Require status checks to pass** e selecione o check da CI. Ele aparece com o nome `validar / Validar e testar` (confira o nome exato na aba *Checks* de um PR; o check só aparece na busca depois de ter rodado ao menos uma vez).

## Observações
- Os validadores de HTML e CSS (`scripts/lib/`) são próprios e **sem dependências**, de propósito: o projeto instala instantaneamente e a lógica fica fácil de explicar. Eles cobrem os erros estruturais mais comuns, mas **não substituem** o validador oficial do W3C nem ferramentas completas como `html-validate` e `stylelint`. Para trocar por elas: `npm install --save-dev html-validate stylelint` e ajuste os scripts `lint:html` e `lint:css` no `package.json`.
- O Dependabot (`.github/dependabot.yml`) abre um Pull Request quando uma action usada nos workflows tem versão nova.
