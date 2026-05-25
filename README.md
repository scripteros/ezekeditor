<img width="1536" height="1024" alt="logo" src="https://github.com/user-attachments/assets/ebb302f2-95c2-41a5-9ece-d6888f184877" />


# Ezek Editor

Um editor de código moderno, rápido e poderoso, inspirado no VS Code e construído com Electron, focado em produtividade e com suporte integrado à Inteligência Artificial e Ferramentas de Segurança.

## 🚀 Características Principais

- **Interface Moderna:** Design responsivo e limpo, semelhante ao VS Code.
- **Suporte a IA Integrado:** Converse com a IA diretamente do editor para gerar, refatorar ou explicar código.
- **Pentest e Análise de Segurança em Tempo Real (NOVO):** Acompanhe a navegação web pelo browser interno, construa um Sitemap dinâmico das URLs acessadas, e receba análises automatizadas da IA sobre as vulnerabilidades de sites e requisições em tempo real.
- **Gerenciador LDAP (NOVO):** Conecte e administre servidores Active Directory / LDAP diretamente pelo painel do editor, possibilitando visualizar e gerenciar usuários da rede.
- **Terminal Embutido:** Acesse o terminal do sistema diretamente da interface do editor.
- **Monaco Editor:** O mesmo núcleo de edição de código do VS Code, garantindo alta performance e syntax highlighting com marca d'água personalizada.
- **Explorador de Arquivos:** Navegue e gerencie seus arquivos de projeto facilmente.
- **Integração com Git:** Veja status de arquivos e realize operações básicas de versionamento, push, pull, manipulação de branches e remotes.

## 🛠️ Tecnologias Utilizadas

- **Desktop:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS
- **Editor:** Monaco Editor
- **Terminal:** XTerm.js
- **Estado:** Zustand
- **Segurança/Proxy:** Hono, Playwright

## 📖 Como Usar o Ezek Editor

1. **Abrir Projetos:** Use o explorador de arquivos na barra lateral esquerda para abrir pastas do seu sistema.
2. **Terminal:** Clique no ícone de terminal no painel inferior para abrir novas instâncias e executar comandos.
3. **Assistente de IA:** Abra o painel da IA para pedir ajuda com códigos, gerar novos componentes ou tirar dúvidas de desenvolvimento.
4. **Git:** O editor detecta automaticamente se a pasta aberta é um repositório Git e mostra o status dos arquivos, remotes e commits na barra lateral.
5. **Ferramentas de Segurança (Pentest):** Acesse a aba de segurança para navegar pela web. Ative os servidores proxy para que a IA intercepte as requisições em tempo real e emita relatórios de vulnerabilidades (ex: Injeção de SQL).
6. **Gerenciador LDAP:** Na barra lateral, acesse o painel LDAP, adicione as credenciais do seu servidor e conecte-se para listar usuários da estrutura.

## 💻 Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (v18 ou superior recomendado)
- npm ou yarn

### Instalação

```bash
# Clone o repositório e acesse a pasta do projeto
# Instale as dependências
npm install
```

### Desenvolvimento

```bash
# Executar a aplicação em modo de desenvolvimento com hot-reload
npm run dev
```

### Build para Produção

```bash
# Criar executável para o seu sistema operacional (Windows, macOS, Linux)
npm run dist

# Apenas compilar o código (sem gerar o instalador)
npm run build
```
Os arquivos compilados estarão na pasta `release` ou `dist`.

## 📄 Licença

Este projeto está sob a licença MIT.
