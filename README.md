<img width="1536" height="1024" alt="logo" src="https://github.com/user-attachments/assets/ebb302f2-95c2-41a5-9ece-d6888f184877" />

# Ezek Editor

Ezek Editor é um editor desktop moderno inspirado no VS Code, construído com Electron, React, TypeScript e Monaco Editor. A aplicação reúne editor de código, terminal, Git, chat com IA, marketplace de provedores, ferramentas SQL, memória Redis e painéis de segurança em uma única interface.

## Principais recursos

- Editor de código com abas, Monaco Editor, syntax highlighting, diff viewer e linhas de indentação.
- Tema global claro/escuro e tema independente para o editor de código.
- Explorador de arquivos com abertura direta no editor ao clicar em qualquer arquivo.
- Terminal integrado com múltiplas sessões usando XTerm.js.
- Integração Git para status, commits, branches, remotes, push e pull.
- Chat de IA com painel lateral, histórico visual mais claro, entrada redesenhada e suporte a execução de tarefas completas.
- Marketplace/configuração de provedores de IA, incluindo OpenAI, OpenRouter, Ollama, RouteWay, CodeBuff e proxies locais.
- Proxies de IA para modelos locais/proxyados: DeepSProxy, KimiProxy e GeminiProxy.
- Painel SQL com conexões PostgreSQL, MySQL e Oracle.
- Workspace SQL no mesmo espaço do editor de código, com abas SQL independentes, renomeáveis, fecháveis, salvas e recuperadas.
- Execução de SQL selecionado ou da folha ativa.
- Resultados SQL em tabela, JSON ou texto, com tema claro/escuro independente.
- Seleção de linhas nos resultados, seleção de texto com mouse, cópia de campos por duplo clique, cópia de tabela/seleção e exportação CSV.
- Ordenação por coluna e exibição do tipo do campo ao lado do nome da coluna quando disponível.
- Carregamento progressivo dos resultados de 100 em 100 linhas.
- Barra de conexões SQL ocultável e redimensionável.
- Cards redimensionáveis nos painéis principais.
- Configuração de múltiplos servidores Redis locais ou em nuvem, com apenas um servidor ativo por vez.
- Memória Redis compartilhada com IA/chat e histórico SQL, com expiração automática de 7 dias.
- Painel de configurações para aparência, editor, terminal, atalhos, sincronização e segurança.
- Painel de extensões/marketplace para recursos de IA.
- Painel de segurança/proxy com navegador, interceptador, pentest e dump de memória de website com análise por IA.
- **Extension Builder**: crie extensões Chrome analisando páginas, modificando elementos em tempo real e gerando extensões com IA.
- **Windows Process Inspector**: inspecione processos, janelas, memória e UI Automation do Windows.
- Gerenciador LDAP para conexões Active Directory/LDAP.

## Editor de código

O editor principal usa Monaco Editor e abre arquivos a partir do explorador lateral. Ele suporta tema automático, claro ou escuro somente para o canvas de código, sem depender do tema global da aplicação.

Recursos do editor:

- Abas de arquivos.
- Visualização de imagens.
- Diff viewer.
- Linhas de indentação.
- Bracket pair colorization.
- Minimap.
- Word wrap.
- Fonte configurável.
- Ligaduras opcionais.
- Sugestões inline.
- Execução rápida de SQL selecionado em arquivos SQL.

## SQL

A área SQL tem duas formas de uso:

- Painel SQL inferior/lateral para conexões, resultados e execução rápida.
- Workspace SQL no mesmo espaço do editor de código, alternando entre editor de arquivos e folhas SQL.

Recursos SQL:

- Várias folhas SQL em abas.
- Criar, renomear, salvar e fechar folhas.
- Recuperação das folhas salvas ao reabrir a aplicação.
- Execução da seleção atual ou da folha inteira.
- Cancelamento de consulta em execução.
- Layout alternável entre editor e resultados, somente editor ou somente resultados.
- Tema claro/escuro independente para o editor SQL.
- Tema claro/escuro independente para os resultados SQL.
- Barra de conexões ocultável.
- Painéis redimensionáveis.

Conectores suportados:

- PostgreSQL
- MySQL
- Oracle

Resultados SQL:

- Visualização em tabela, JSON e texto.
- Seleção de uma ou mais linhas.
- Seleção manual de texto com o mouse.
- Cópia de campo por duplo clique.
- Cópia da tabela inteira ou somente das linhas selecionadas.
- Exportação CSV.
- Ordenação por coluna.
- Exibição de tipos de campos quando o banco retorna essa informação.
- Renderização inicial de 100 linhas com botão para carregar mais 100 a cada clique.

## Redis e memória da IA

O Redis fica dentro da configuração de conexão SQL, na seção de edição de conexão.

É possível cadastrar vários servidores Redis, locais ou em nuvem. Os servidores aparecem em cards, mas apenas um fica ativo por vez. Ao ativar um servidor, os demais são desativados automaticamente para a memória da IA.

Campos suportados:

- Nome do servidor.
- Modo local ou nuvem.
- URL Redis ou `rediss://`.
- Host e porta.
- Usuário e senha.
- Database.
- TLS/SSL.

A memória salva no Redis é usada pelo chat de IA e pelo histórico SQL. Os dados ficam com TTL de 7 dias.

## IA

O chat de IA foi ajustado para responder sem repetir em toda mensagem que é o Ezek. A IA recebe contexto do editor, das conversas e da memória Redis ativa quando configurada.

Recursos:

- Chat lateral com visual mais claro para leitura.
- Campo de mensagem maior e redesenhado.
- Envio de prompts para geração, explicação e alteração de código.
- Execução de tarefas com retorno de conclusão.
- Abertura de SQL sugerido pela IA no workspace SQL.
- Execução manual de SQL com resultado exibido na aba SQL.
- Configurações de provedores e modelos.
- Suporte a marketplace/proxies quando disponíveis localmente.

Provedores/configurações suportadas:

- OpenAI
- OpenRouter
- Ollama
- RouteWay
- CodeBuff
- Custom API
- DeepSProxy
- KimiProxy
- GeminiProxy

## Configurações

O painel de configurações concentra ajustes de:

- Aparência global.
- Tema claro/escuro.
- Efeito de vidro, opacidade e blur.
- Tema do editor de código: automático, claro ou escuro.
- Fonte do editor.
- Cursor pulsante.
- Ligaduras.
- Sugestões fantasma.
- Nível de automação de refatoração.
- Tamanho da fonte do terminal.
- Cursor piscando no terminal.
- Atalhos, sincronização e segurança.

As preferências visuais são persistidas localmente via `localStorage`.

## Segurança

O painel de segurança (Security Lab) oferece um conjunto completo de ferramentas para análise e pentest:

- Navegador de segurança integrado com proxy local.
- **Dump de Memória de Website**: captura o estado completo de um site carregado — DOM, variáveis JavaScript globais, localStorage, sessionStorage, campos hidden, strings codificadas (Base64/JWT) — e permite análise automática com IA para identificar tokens, chaves e dados sensíveis expostos.
- Interceptador de tráfego HTTP/HTTPS.
- Scanner de vulnerabilidades (PenTest Engine) com varreduras completas.
- Auditor de segurança com relatórios.
- Mapa do site e histórico de navegação.
- Modo Hacker com chat especializado para pentest.

## Extension Builder

Um módulo completo para criar extensões Chrome diretamente no Ezek:

- Navegador integrado para carregar qualquer site.
- **Análise de elementos**: escaneia a página e lista todos os elementos interativos (botões, inputs, links, imagens, formulários) com seletores CSS.
- **Modificações visuais em tempo real**: insira, modifique, remova ou estilize elementos diretamente na página carregada com preview instantâneo.
- Editor de código JavaScript integrado para cada modificação.
- **Assistente IA**: descreva o que quer fazer ("adicione um botão flutuante de dark mode") e a IA gera o código automaticamente.
- **Geração de extensão Chrome**: cria automaticamente `manifest.json` (Manifest V3) e `content.js` com todas as modificações, empacota em `.zip` e salva em pasta.
- Compatível com instalação direta em `chrome://extensions` via "Carregar sem compactação".

## Windows Process Inspector

Módulo para inspeção de processos e janelas Windows em tempo real:

- Lista todos os processos com janelas abertas no sistema.
- Lista janelas visíveis com classes, dimensões e títulos.
- **Dump de memória**: captura strings da memória de qualquer processo.
- Leitura de regiões de memória com visualização em hex dump.
- Inspeção de árvore de UI Automation de qualquer janela.
- Injeção de JavaScript em webviews para debug.

## LDAP / Active Directory

Conexão e gerenciamento de diretórios LDAP/AD:

- Conexão com servidores LDAP/Active Directory.
- Listagem e busca de usuários.
- Visualização de atributos e grupos.

## Dados persistidos localmente

Algumas informações da interface são salvas no armazenamento local do Electron/browser:

- Folhas SQL e resultados recentes: store `sql-storage`.
- Conexões SQL.
- Servidores Redis cadastrados e Redis ativo.
- Tema SQL e tema dos resultados.
- Configurações visuais e do editor.
- Configurações de IA.

O executável gerado não deve versionar a pasta `release/`; ela é saída de build local.

## Tecnologias

- Electron
- Electron Vite
- React
- TypeScript
- Tailwind CSS
- Monaco Editor
- Zustand
- XTerm.js
- Lucide React
- PostgreSQL via `pg`
- MySQL via `mysql2`
- Oracle via `oracledb`
- Redis via `ioredis`
- Git via `simple-git`

## Requisitos

- Node.js 18 ou superior.
- npm.
- Git instalado no sistema para recursos Git.
- Oracle Client opcional para conexões Oracle em modo thick.
- Redis opcional para memória compartilhada da IA.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

## Build

Compilar o código:

```bash
npm run build
```

Gerar instalador/executável:

```bash
npm run dist
```

No Windows, o instalador é gerado em:

```text
release/Ezek Setup 1.0.0.exe
```

A versão descompactada para teste fica em:

```text
release/win-unpacked/Ezek.exe
```

## Scripts

```bash
npm run dev       # inicia a aplicação em desenvolvimento
npm run build     # compila main, preload e renderer
npm run preview   # abre preview do build
npm run pack      # empacota sem gerar instalador
npm run dist      # gera instalador em release/
```

## Observações de build

O pacote precisa incluir `node_modules` de produção dentro do `app.asar`, pois dependências como `simple-git`, drivers SQL e Redis são usadas no processo principal do Electron.

A configuração atual do `electron-builder` inclui:

- `out/**/*`
- `package.json`
- `icon.ico`
- `ico.png`
- `logo.png`

## Licença

MIT.
