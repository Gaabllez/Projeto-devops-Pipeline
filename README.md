# PingFlow CI/CD — Pipeline de Conectividade e Publicação

![Ping](https://github.com/Gaabllez/Ping-test-pipeline-/actions/workflows/ping.yml/badge.svg)
![CI](https://github.com/Gaabllez/Ping-test-pipeline-/actions/workflows/ci.yml/badge.svg?event=pull_request)
![CD](https://github.com/Gaabllez/Ping-test-pipeline-/actions/workflows/deploy.yml/badge.svg)

Projeto acadêmico de DevOps que demonstra automação com **GitHub Actions**, testes de conectividade, validação de código, testes automatizados e publicação contínua de um site estático no **GitHub Pages**.

O repositório reúne duas frentes complementares: uma pipeline de conectividade (ICMP e HTTPS) e uma pipeline de CI/CD para validar e publicar o site de demonstração.

## Objetivos

- Automatizar verificações de conectividade com o GitHub.
- Validar a estrutura do HTML e a sintaxe do CSS.
- Executar testes automatizados com o test runner nativo do Node.js.
- Bloquear a publicação quando as validações ou os testes falharem.
- Publicar automaticamente o conteúdo de `public/` no GitHub Pages.

## Tecnologias

- Git e GitHub
- GitHub Actions
- Ubuntu Linux e Bash
- Node.js 22 ou superior
- HTML5 e CSS3
- `ping` (ICMP) e `curl` (HTTPS)
- GitHub Pages

## Workflows

| Workflow | Quando executa | O que faz |
|---|---|---|
| `ping.yml` | Push na `main` ou execução manual | Verifica a estrutura do workflow, testa conectividade ICMP e HTTPS com o GitHub. |
| `ci.yml` | Pull Request para `main` ou execução manual | Chama o workflow reutilizável de validação e executa lint e testes. |
| `validate.yml` | Quando chamado por outro workflow | Instala as dependências, valida HTML/CSS e executa os testes automatizados. |
| `deploy.yml` | Push na `main` ou execução manual | Executa as validações e, se tudo passar, publica `public/` no GitHub Pages. |

### Pipeline de conectividade

O workflow `ping.yml` executa as seguintes etapas:

1. Obtém o código do repositório.
2. Exibe informações da execução (repositório, branch, commit e autor).
3. Confere se a estrutura básica do workflow existe.
4. Tenta quatro pacotes ICMP para `github.com`. Se não houver resposta, registra um aviso e continua, pois alguns ambientes bloqueiam ICMP.
5. Faz uma requisição HTTPS para `https://github.com/` com `curl`. Essa etapa é obrigatória e reprova a execução se a requisição falhar.
6. Exibe uma mensagem de encerramento.

### CI: validação e testes

A CI é iniciada em Pull Requests direcionados à branch `main`. O workflow `ci.yml` reutiliza `validate.yml`, evitando duplicar a definição das etapas.

- **Lint HTML:** verifica estrutura, tags, atributos e regras básicas de acessibilidade.
- **Lint CSS:** verifica blocos, declarações, delimitadores e cores hexadecimais.
- **Testes:** executa a suíte automatizada com `node --test`.

### CD: publicação

O workflow `deploy.yml` é iniciado em push na `main` ou manualmente. A publicação depende da aprovação da validação e dos testes. Somente a pasta `public/` é enviada ao GitHub Pages; scripts, testes e configurações não são publicados.

## Estrutura do projeto

```text
.
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ping.yml
│       ├── ci.yml
│       ├── validate.yml
│       └── deploy.yml
├── public/
│   ├── index.html
│   └── style.css
├── scripts/
│   ├── lint-html.js
│   ├── lint-css.js
│   └── lib/
│       ├── html-lint.js
│       ├── css-lint.js
│       ├── lines.js
│       └── run-lint.js
├── tests/
├── package.json
├── package-lock.json
└── README.md
```

## Executar localmente

Requisitos: Node.js 22 ou superior e npm.

```bash
npm ci
npm run lint:html
npm run lint:css
npm test
```

Para executar todas as verificações em sequência:

```bash
npm run check
```

Para abrir o site localmente, execute na raiz do projeto:

```bash
python -m http.server 8000 --directory public
```

Depois, acesse `http://localhost:8000` no navegador.

## Como testar no GitHub

1. Crie uma branch para a alteração: `git switch -c feature/minha-alteracao`.
2. Faça a alteração no projeto.
3. Execute `npm run check` localmente.
4. Registre e envie a branch:
   ```bash
   git add .
   git commit -m "feat: descreve a alteracao"
   git push -u origin feature/minha-alteracao
   ```
5. Abra um Pull Request de `feature/minha-alteracao` para `main`.
6. Na aba **Actions** ou na seção **Checks** do Pull Request, confira a execução da CI.
7. Após a aprovação, faça o merge. O push na `main` inicia a pipeline de conectividade e a CD.
8. Confira a publicação na aba **Actions** e em **Settings → Pages**.

### Testar uma falha de validação

Em uma branch de teste, faça uma alteração inválida no HTML (por exemplo, remova o elemento `<main>`), execute `npm run check` e confirme que a validação reprova. Não faça essa alteração diretamente na `main`.

## Configurar o GitHub Pages

Na primeira publicação:

1. Abra **Settings → Pages** no repositório.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Faça merge de um Pull Request na `main` ou inicie manualmente o workflow **CD - Publicacao do Site**.
4. Consulte o endereço publicado no resumo da execução ou em **Settings → Pages**.

## Observações técnicas

- A ausência de resposta ao `ping` não reprova a pipeline: redes e servidores podem bloquear tráfego ICMP. O teste HTTPS com `curl` é a verificação obrigatória de conectividade.
- Os validadores de HTML e CSS são implementações didáticas próprias, sem dependências externas. Eles cobrem regras estruturais selecionadas e não substituem validadores completos, como os serviços do W3C ou ferramentas especializadas.
- O Dependabot verifica mensalmente atualizações das GitHub Actions utilizadas nos workflows.
- Para proteger a branch `main`, configure uma regra em **Settings → Rules → Rulesets** exigindo Pull Request e aprovação dos checks da CI. O nome exato do check pode ser conferido na seção **Checks** de um Pull Request após a primeira execução.

## Objetivo acadêmico

Demonstrar, na prática, conceitos de DevOps e integração/entrega contínuas: automação de tarefas, execução em runners Linux, validação de código, testes automatizados, controle de versões e publicação de artefatos.
