# Projeto DevOps — CI/CD, GitFlow e DevSecOps

[![CI](https://github.com/Gaabllez/Projeto-devops-Pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/Gaabllez/Projeto-devops-Pipeline/actions/workflows/ci.yml)
[![CD](https://github.com/Gaabllez/Projeto-devops-Pipeline/actions/workflows/deploy.yml/badge.svg)](https://github.com/Gaabllez/Projeto-devops-Pipeline/actions/workflows/deploy.yml)

Projeto acadêmico de Cultura e Práticas DevOps. O repositório contém um site estático em HTML/CSS e uma esteira automatizada no GitHub Actions.

## Tecnologias

- HTML5 e CSS3
- Node.js 22 e testes nativos com `node:test`
- Git e GitHub com GitFlow
- GitHub Actions e GitHub Pages
- CodeQL para SAST (análise estática)
- OWASP ZAP Baseline para DAST (análise dinâmica)

## Estrutura

```text
.
├── public/                  # site publicado
│   ├── index.html
│   └── style.css
├── scripts/                 # validadores de HTML e CSS
├── tests/                   # testes automatizados e de regressão
└── .github/workflows/
    ├── validate.yml         # lint e testes reutilizáveis
    ├── security.yml         # SAST + DAST reutilizáveis
    ├── ci.yml                # CI em branches e Pull Requests
    └── deploy.yml            # CD após integração na main
```

## Esteira CI/CD + DevSecOps

### CI — Integração Contínua (`.github/workflows/ci.yml`)

Dispara em pushes para `feature/*`, `feat/*`, `develop`, `release/*` e `hotfix/*, em Pull Requests para `develop` ou `main`, e manualmente.

1. **Build/validação:** prepara Node.js e instala dependências.
2. **Lint:** valida HTML e CSS.
3. **Testes:** executa os testes automatizados do projeto.
4. **SAST — CodeQL:** analisa estaticamente o JavaScript e publica os resultados na área Security/Code scanning do GitHub.
5. **DAST — OWASP ZAP:** inicia uma prévia local do site e executa uma varredura baseline. A ação falha para alertas não aceitos. As exceções específicas do ambiente de hospedagem estão documentadas em `.zap/rules.tsv`; novos alertas continuam bloqueando a integração.

Os jobs dependentes só avançam depois do sucesso das etapas anteriores.

### CD — Entrega Contínua (`.github/workflows/deploy.yml`)

Dispara após push/merge na `main` ou por execução manual. Repete lint, testes, SAST e DAST. O deploy só inicia se todas as validações de segurança e qualidade passarem. A pasta `public/` é publicada no GitHub Pages pelas actions oficiais.

## Configurar o GitHub Pages

No repositório, acesse **Settings → Pages → Build and deployment** e selecione **Source: GitHub Actions**. A publicação será feita pelo workflow `deploy.yml`; não é necessário criar a branch `gh-pages`.

## Testar localmente

Requer Node.js 22 ou superior.

```bash
npm ci
npm run check
```

## Fluxo GitFlow para apresentação

- `main`: versão estável/publicada.
- `develop`: branch de integração.
- `feature/*`: desenvolvimento de funcionalidade.
- `release/*`: preparação de uma versão.
- `hotfix/*`: correção urgente a partir da versão estável.

Demonstração sugerida:

```bash
# atualizar a branch de integração
git switch develop
git pull origin develop

# criar uma funcionalidade
git switch -c feature/minha-melhoria

# alterar arquivos e validar
npm run check

# registrar e enviar a mudança
git add .
git commit -m "feat: descreve a melhoria"
git push -u origin feature/minha-melhoria
```

Depois, abrir um Pull Request de `feature/minha-melhoria` para `develop`, conferir os checks na aba **Actions** e fazer o merge. Para preparar uma versão, abrir um Pull Request de `develop` para `main`; após o merge, a CD executa e publica o site.

## Segurança

- O SAST utiliza CodeQL com o conjunto de consultas `security-extended`; o resultado fica disponível em **Security → Code scanning**.
- O DAST utiliza OWASP ZAP Baseline contra uma prévia local do site, antes do merge/deploy. O relatório é anexado à execução do workflow.
- Não há token externo do SonarCloud nem credenciais de aplicação no código.
- Não ignore alertas do ZAP sem revisar o relatório e justificar a exceção.
- O arquivo `.zap/rules.tsv` aceita apenas avisos relacionados a cabeçalhos HTTP que o GitHub Pages não permite personalizar no nível do repositório, incluindo a diretiva CSP `frame-ancestors`, além do cache de conteúdo estático público.
- A política CSP incluída na página via meta tag é complementar; ela não substitui um cabeçalho CSP HTTP. Em uma hospedagem que permita configurar cabeçalhos, remova as exceções correspondentes e configure as proteções no servidor.
