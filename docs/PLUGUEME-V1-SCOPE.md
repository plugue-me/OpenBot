# PLUGUEME V1 — ESPECIFICAÇÃO PRINCIPAL DE DESENVOLVIMENTO

## 1. Missão

Atue como engenheiro de software sênior, arquiteto de sistemas, especialista em agentes autônomos, segurança, infraestrutura e desenvolvimento de produtos SaaS.

Estamos desenvolvendo o Plugueme, uma plataforma comercial de funcionários digitais autônomos para empresas, utilizando como base o código-fonte MIT recuperado do OpenBot da CopilotKit.

O objetivo não é reproduzir integralmente o OpenBot original.

O objetivo é transformar o código existente em um produto próprio, independente, exclusivamente web, comercializável e distribuído em infraestrutura controlada por nós.

Aproveite ao máximo as implementações existentes. Remova ou desative funcionalidades que não fazem parte do escopo definido neste documento.

Não reconstrua funcionalidades que já funcionam.

Este documento substitui os escopos e prompts anteriores.

## 2. Contexto e estado atual

Repositório:

https://github.com/plugue-me/OpenBot

Branch de desenvolvimento:

codex/plugueme-intelligence

O backend original foi recuperado do histórico Git, a partir da versão imediatamente anterior ao commit:

f71b0f4bb6223bc1c7aa0026ad0e3bd5ef9233b0

Esse commit removeu componentes do código-fonte público e passou a utilizar imagens Docker publicadas pela CopilotKit.

A versão recuperada contém o servidor sob licença MIT, migrations, workers, runtimes de agentes, frontend e outros componentes importantes.

O primeiro marco independente já foi implementado e validado.

Resultados reportados:

- Inicialização independente do CopilotKit Intelligence.
- Inicialização sem licença CopilotKit.
- Inicialização sem Composio.
- Interface original funcionando.
- Criação de agentes.
- Credenciais OpenAI criptografadas no Vault.
- Conversa real com OpenAI.
- Streaming de respostas.
- Persistência PostgreSQL.
- Histórico preservado após reload e reinício.
- 14 testes standalone aprovados.
- 291 testes de regressão aprovados.
- Frontend compilado.
- Backend de produção com typecheck aprovado.

O typecheck global da árvore de testes ainda possui erros.

Esses resultados representam o estado documentado anteriormente. Confirme o estado atual do repositório antes de iniciar novas alterações.

Arquivos que devem ser lidos obrigatoriamente:

- docs/implementation-progress.md
- docs/standalone-architecture.md
- docs/standalone-test-report.md
- docs/independence-audit.md

Verifique também o histórico Git e alterações posteriores ao commit funcional c5d26cd9.

Não atualize a branch para a main upstream da CopilotKit.

Não refaça o primeiro marco.

## 3. Modelo comercial e distribuição

O Plugueme será uma aplicação exclusivamente web.

O cliente acessará a plataforma pelo navegador utilizando um domínio ou subdomínio fornecido por nós.

Cada cliente terá uma VPS exclusiva.

A mensalidade futura incluirá infraestrutura e acesso à plataforma.

O cliente fornecerá as próprias credenciais de provedores de IA, utilizando o modelo BYOK.

O cliente não receberá:

- Código-fonte do backend.
- Acesso SSH.
- Acesso administrativo ao Docker.
- Credenciais do container registry.
- Imagem Docker para instalação própria.
- Aplicativo desktop.
- Aplicativo mobile nativo.
- Extensão de navegador.

A distribuição será realizada por imagens Docker próprias, versionadas e armazenadas futuramente em registry privado.

A VPS será administrada exclusivamente por nós.

Não confunda proteção do backend com impossibilidade de copiar o frontend. O navegador necessariamente recebe código JavaScript. Não publique source maps de produção, segredos, código-fonte desnecessário ou informações internas.

O provisionamento automatizado de VPS, cobrança e assinaturas serão implementados futuramente. Não fazem parte deste ciclo.

A instalação final deve funcionar em uma VPS limpa por meio de Docker Compose ou mecanismo equivalente documentado.

## 4. Princípios obrigatórios

- Preservar a arquitetura existente.
- Preservar a interface original como base.
- Reutilizar serviços, schemas, migrations, componentes e testes.
- Manter TypeScript, Bun, Hono, React, Vite, Drizzle e PostgreSQL.
- Não migrar para NestJS, Next.js, Prisma ou outros frameworks sem necessidade técnica comprovada.
- Não desenvolver microsserviços desnecessários.
- Não criar um segundo motor de execução para tarefas.
- Não depender do CopilotKit Intelligence.
- Não depender do Composio.
- Não depender do Arcade.
- Não simular licenças ou entitlements.
- Não utilizar imagens proprietárias sem autorização.
- Não extrair ou copiar implementações proprietárias.
- Preservar avisos de copyright e licença MIT.
- Verificar licenças das dependências utilizadas.
- Não introduzir serviços pagos obrigatórios sem autorização.
- Não enfraquecer mecanismos de segurança existentes.

O objetivo é independência funcional e comercial real.

## 5. Escopo definitivo do produto

### Funcionários e comunicação — obrigatório

- Criar funcionários.
- Editar funcionários.
- Excluir ou arquivar funcionários.
- Funcionários preconfigurados.
- Chat individual com streaming.
- Conversas em grupo.
- Comunicação entre funcionários.
- Delegação de tarefas entre funcionários.
- Notificações internas.
- Mensagens não lidas.
- Funcionários favoritos e fixados.

Conversas por voz estão fora do escopo.

### Autonomia — obrigatório

- Criação e execução de tarefas.
- Rotinas.
- Agendamentos.
- Metas e objetivos.
- Check-ins proativos.
- Execução com navegador fechado.
- Aprovação humana de ações.
- Histórico de atividades.

### Memória e conhecimento — obrigatório

- Memória individual por funcionário.
- Memória compartilhada da empresa.
- Upload de arquivos.
- Geração de arquivos.
- Skills personalizadas.

Automatic Learning e Recorder estão fora do escopo.

### Ferramentas e integrações — obrigatório

- Cadastro de MCPs personalizados.
- MCPs remotos.
- Autenticação OAuth para integrações.
- Vault de credenciais.
- Navegador próprio do funcionário.
- Terminal.
- Execução de comandos.
- Computador isolado por funcionário.

Composio, Arcade, Slack e Teams estão fora do escopo.

### Infraestrutura e administração — obrigatório

- Login.
- Gerenciamento de usuários.
- Permissões.
- Controle de acesso.
- Múltiplos provedores de IA.
- BYOK.
- Consumo de IA por funcionário.
- Logs.
- Auditoria.
- Imagens Docker próprias.
- Backup.
- Restauração.

Aplicativos desktop, mobile nativo, extensão de navegador, cobrança, assinaturas e provisionamento automatizado estão fora do escopo.

Não implemente funcionalidades fora dessa definição sem autorização.

## 6. Interface e experiência visual

A interface original do OpenBot da CopilotKit é a base visual do produto.

Preserve principalmente:

- Barra lateral de navegação por ícones.
- Sidebar de funcionários e conversas.
- Campo de busca.
- Funcionários fixados no topo.
- Lista de funcionários com avatares.
- Indicadores de mensagens não lidas.
- Preview das últimas mensagens.
- Área central de conversa.
- Abas de conversas.
- Seletor de modelo de IA.
- Composer de mensagens.
- Streaming de respostas.
- Exibição de arquivos.
- Histórico de atividades.
- Atualizações entre funcionários.
- Mensagens encaminhadas entre funcionários.
- Estados de execução.
- Aprovações.
- Painéis laterais existentes que sejam úteis.

O layout deve continuar semelhante ao OpenBot, não a um dashboard administrativo genérico.

Preserve os componentes, comportamento, responsividade e organização existentes sempre que possível.

Não faça uma reconstrução completa da interface.

Crie uma estrutura de identidade visual própria que permita alterar posteriormente:

- Logotipo.
- Nome do produto.
- Favicon.
- Cores.
- Tipografia.
- Avatares dos funcionários.
- Ícones.
- Nomenclaturas.
- Tokens de design.
- Temas.

Não invente uma identidade visual definitiva sem minha aprovação.

Centralize configurações de marca e tokens de design.

Retire referências comerciais ao OpenBot e à CopilotKit da experiência de marca quando apropriado, preservando os avisos legais exigidos.

A aplicação web pode ser responsiva para navegadores de celular. Isso não significa desenvolver um aplicativo mobile nativo.

## 7. ETAPA 1 — Adequação ao produto exclusivamente web

Inspecione a arquitetura do repositório.

Identifique as dependências relacionadas a:

- Desktop.
- Mobile.
- Extension.
- Recorder.
- Voz e ditado.
- Automatic Learning.
- Composio.
- Arcade.
- Slack.
- Teams.
- Inspector proprietário.
- Telemetria externa.
- CopilotKit Intelligence.

Classifique cada componente:

1. Necessário para o Plugueme.
2. Compartilhado com funcionalidades necessárias.
3. Opcional.
4. Pode ser desativado.
5. Pode ser removido da distribuição.
6. Pode ser removido do código com segurança.

Não exclua diretórios indiscriminadamente.

Primeiro remova funcionalidades fora do escopo do build, inicialização, rotas, navegação e dependências obrigatórias.

Somente remova código definitivamente após verificar imports, contratos, testes e dependências compartilhadas.

Não altere migrations antigas que já foram aplicadas. Utilize novas migrations quando alterações no schema forem necessárias.

### Interface

Retire da navegação e da experiência de usuário:

- Recursos de voz.
- Recorder.
- Automatic Learning.
- Integrações Composio.
- Arcade.
- Slack.
- Teams.
- Links de download do desktop.
- Links de instalação de aplicativos.
- Configurações de serviços proprietários.
- Alertas comerciais que não se aplicam ao produto independente.

Não deixe botões sem implementação.

Não esconda falhas reais retornando listas vazias falsas.

Implemente um sistema central de capacidades que permita representar funcionalidades disponíveis, indisponíveis e em desenvolvimento.

Ao final desta etapa, o frontend deve continuar compilando e o chat independente deve continuar funcionando.

## 8. ETAPA 2 — Motor de execução independente e memória

Analise o motor existente:

- server/src/standalone/runner.ts
- server/src/standalone/store.ts
- server/src/standalone/bootstrap.ts
- server/src/standalone-entry.ts
- toolkit/src/run-turn.ts
- server/src/copilot.ts
- server/src/work/
- server/src/memory/
- server/src/tasks/
- worker/

Atualmente existe uma implementação local baseada em:

- local_threads
- local_runs
- local_events
- LocalAgentRunner
- PostgreSQL
- Leases
- Eventos AG-UI

Preserve esse trabalho.

Todos os trabalhos iniciados por chat, delegação, tasks, rotinas, goals e check-ins devem utilizar a mesma infraestrutura de execução.

Implemente progressivamente:

- Execução headless.
- Controle de concorrência.
- Controle de leases.
- Renovação de leases.
- Recuperação de leases expiradas.
- Cancelamento.
- Encerramento controlado.
- Tratamento de falhas.
- Persistência de eventos.
- Reconexão.
- Replay de eventos.
- Prevenção de execuções duplicadas.
- Controle de consumo.
- Retenção de eventos.
- Recuperação após reinício.

Não prometa retomada transparente de operações externas não idempotentes.

Execuções interrompidas precisam possuir estados reais e compreensíveis.

Não repita automaticamente pagamentos, publicações, exclusões ou alterações externas após falhas ambíguas.

Priorize PostgreSQL e os mecanismos existentes. Não adicione Redis ou BullMQ sem necessidade comprovada.

### Memória individual

Investigue a implementação existente em:

server/src/memory/

Investigue também o histórico relacionado à migration:

0054_memory_on_intelligence.sql

Recupere implementações anteriores MIT quando apropriado.

A memória individual deve permitir:

- Salvar informações relevantes por funcionário.
- Recuperar informações em novas conversas.
- Atualizar memória.
- Excluir memória.
- Deduplicar informações.
- Controlar contexto.
- Respeitar permissões.
- Persistir após reinício.

### Memória compartilhada da empresa

Implemente uma camada de conhecimento compartilhado entre funcionários autorizados.

Exemplos:

- Dados institucionais.
- Produtos e serviços.
- Processos internos.
- Políticas da empresa.
- Informações comerciais.
- Documentos.
- Contexto operacional.

Diferencie:

- Histórico de conversa.
- Memória individual.
- Memória compartilhada.
- Base de conhecimento.
- Skills.

Não transforme automaticamente todo o histórico em memória compartilhada.

Garanta isolamento entre usuários, agentes e informações privadas.

Utilize pgvector quando necessário, mas permita funcionamento básico sem um provedor obrigatório de embeddings.

Automatic Learning está fora do escopo. A memória não precisa depender dele.

## 9. ETAPA 3 — Funcionários, comunicação e delegação

Preserve e integre os módulos originais de:

- agents
- channels
- team-bots
- responsibilities
- delivery
- activity

O Plugueme precisa oferecer uma equipe de funcionários que trabalha em conjunto.

### Comunicação individual

Preserve o chat com streaming, histórico, arquivos, contexto e estados de execução.

### Conversas em grupo

Permita que usuários e funcionários participem de uma conversa compartilhada conforme permissões.

Preserve identidade e autoria de cada mensagem.

Evite que todos os agentes respondam desnecessariamente a todas as mensagens.

Implemente regras claras de participação.

### Comunicação entre funcionários

Um funcionário deve poder enviar uma mensagem a outro funcionário.

Exemplo:

O Gestor de Operações solicita ao Analista Financeiro um relatório.

O Analista Financeiro executa o trabalho, gera o resultado e devolve ao Gestor de Operações.

O Gestor de Operações consolida o resultado e informa o empresário.

Essa comunicação deve:

- Ser registrada.
- Possuir remetente e destinatário.
- Respeitar permissões.
- Possuir contexto.
- Aparecer na interface.
- Funcionar com navegador fechado.
- Utilizar o motor de execução independente.

### Delegação

Um funcionário deve conseguir criar tarefas para outros funcionários autorizados.

Garanta:

- Identificação de quem delegou.
- Responsável pela tarefa.
- Objetivo.
- Contexto.
- Resultado.
- Status.
- Histórico.
- Correlação entre tarefa e conversa.

Implemente limites contra loops de delegação, ciclos infinitos e consumo excessivo.

Não permita que agentes ampliem suas próprias permissões por delegação.

### Notificações e mensagens não lidas

Reaproveite os mecanismos originais de:

- Marcadores de leitura.
- Mensagens não lidas.
- Atividades recentes.
- Funcionários fixados.
- Favoritos.
- Notificações internas.

Não dependa do Intelligence para esses recursos.

Preserve o comportamento visual original.

### Teste obrigatório

Crie dois funcionários de teste:

- Gerente.
- Analista.

O Gerente deve delegar uma atividade ao Analista, receber o resultado e apresentar uma resposta ao usuário.

Valide a execução sem que a interface permaneça aberta.

Utilize provedores simulados em testes automatizados.

## 10. ETAPA 4 — Autonomia, tasks, rotinas, goals e check-ins

Analise e reaproveite os módulos originais:

- server/src/tasks/
- server/src/routines/
- server/src/proactive/
- server/src/responsibilities/
- server/src/work/
- worker/

### Tasks

Permita criar tarefas:

- Pelo usuário.
- Por um funcionário.
- Por outro funcionário que delega.
- Por uma rotina.
- Por um objetivo.

As tarefas devem possuir estados reais, como:

- Pendente.
- Em execução.
- Aguardando aprovação.
- Concluída.
- Falhou.
- Cancelada.
- Interrompida.

Adapte a nomenclatura aos estados já existentes.

Não invente schemas paralelos quando houver estruturas originais adequadas.

Persista progresso, eventos, resultados, erros e responsáveis.

### Rotinas

Permita:

- Agendamentos recorrentes.
- Expressões CRON.
- Fusos horários.
- Horário de execução.
- Ativação.
- Desativação.
- Execução manual.
- Histórico.
- Tratamento de falhas.
- Limites de concorrência.

O servidor e os workers devem executar as rotinas sem depender do navegador aberto.

Defina comportamento explícito para rotinas perdidas durante indisponibilidade.

Evite execuções duplicadas.

### Goals

Preserve a capacidade de atribuir metas e objetivos aos funcionários.

Os funcionários devem conseguir acompanhar progresso, executar atividades relacionadas e registrar resultados.

Uma meta não deve autorizar consumo infinito de recursos ou ações externas irrestritas.

### Check-ins

Permita que funcionários realizem verificações proativas e comuniquem resultados.

Exemplos:

- Verificar indicadores comerciais.
- Identificar tarefas atrasadas.
- Verificar campanhas de marketing.
- Acompanhar objetivos.
- Emitir alertas relevantes.

Os check-ins devem possuir limites de execução e consumo.

### Teste obrigatório

Configure uma rotina de teste.

Feche o navegador.

Aguarde o disparo pelo worker.

Verifique posteriormente na interface:

- Execução.
- Resultado.
- Histórico.
- Notificação.
- Estado da tarefa.

Teste também falha, cancelamento, reinício e prevenção de duplicidade.

## 11. ETAPA 5 — MCP, OAuth, aprovações, skills e computador dos agentes

### MCP

Preserve o suporte nativo ao Model Context Protocol.

A aplicação deve permitir cadastrar servidores MCP personalizados.

Investigue o suporte original a:

- MCP remoto.
- Streamable HTTP.
- SSE, quando necessário para compatibilidade.
- MCP local via processos controlados, quando suportado.
- API Keys.
- Headers de autenticação.
- OAuth.
- Descoberta de ferramentas.
- Schemas de entrada.
- Teste de conexão.
- Habilitação por funcionário.
- Revogação de acesso.

Não dependa de Composio ou Arcade.

Não permita que o cadastro de MCPs crie acesso irrestrito a redes privadas, metadados de infraestrutura, serviços internos ou credenciais.

### OAuth

Reaproveite os módulos existentes de autenticação.

Implemente:

- Conexão.
- Callback.
- State.
- PKCE, quando aplicável.
- Armazenamento criptografado.
- Renovação de tokens.
- Revogação.
- Isolamento por usuário e funcionário.
- Permissões.

Não desenvolva uma plataforma com centenas de integrações nesta etapa.

O requisito é uma infraestrutura genérica e funcional para conectar ferramentas autorizadas.

### Vault

Preserve o Vault existente.

Garanta que credenciais sejam:

- Criptografadas.
- Utilizadas apenas por processos autorizados.
- Nunca retornadas em plaintext ao frontend sem necessidade.
- Nunca expostas em logs.
- Nunca inseridas em prompts desnecessariamente.
- Revogáveis.
- Atualizáveis.

### Aprovações

Reaproveite o sistema original de aprovações e políticas.

Toda ação sensível deve respeitar as permissões e aprovações configuradas.

Exemplos:

- Publicar conteúdo.
- Alterar campanhas.
- Modificar orçamento.
- Excluir arquivos importantes.
- Enviar comunicações externas.
- Executar comandos de risco.
- Alterar sistemas externos.

Uma ação pendente de aprovação não deve ser executada antecipadamente.

Garanta que a aprovação esteja vinculada à ação concreta, seus parâmetros e o ator responsável.

Não permita reutilizar aprovação para outra ação sem autorização correspondente.

Persista estados de aprovação para sobreviver a desconexões e reinícios.

Se a execução não puder ser retomada com segurança após uma aprovação, apresente o estado real e não duplique a operação.

### Skills personalizadas

Preserve o sistema original de skills.

Permita:

- Criar.
- Editar.
- Importar.
- Ativar.
- Desativar.
- Atribuir a funcionários.
- Definir permissões.
- Versionar quando apropriado.

Skills não devem ampliar permissões de execução automaticamente.

### Arquivos

Permita upload e geração de arquivos.

Garanta:

- Isolamento por funcionário e usuário.
- Controle de acesso.
- Limites de tamanho.
- Validação de caminhos.
- Proteção contra path traversal.
- Persistência.
- Download autorizado.
- Auditoria.
- Tratamento de tipos de arquivos perigosos.

### Computador dos funcionários

Investigue os componentes recuperados:

- agent-computer/
- server/src/computer/
- server/src/browser/
- server/src/host-access/
- supervisor, quando disponível.
- Dockerfiles relacionados.

Recupere e preserve a capacidade de cada funcionário possuir um ambiente isolado de execução.

O ambiente deve permitir:

- Navegação web.
- Terminal.
- Execução de comandos.
- Manipulação de arquivos.
- Geração de documentos.
- Automação de tarefas.
- Utilização de ferramentas autorizadas.

Não dependa de uma extensão instalada no navegador do cliente.

O navegador do funcionário deve rodar no servidor.

O computador do funcionário deve possuir isolamento adequado.

Não exponha o Docker socket diretamente ao agente.

Não permita acesso arbitrário ao host.

Evite containers privilegiados.

Implemente limites de:

- CPU.
- Memória.
- Disco.
- Processos.
- Tempo de execução.
- Rede.
- Concorrência.

Os ambientes podem ser iniciados sob demanda e suspensos quando ociosos, desde que o estado necessário seja preservado.

Não mantenha um navegador pesado permanentemente ativo para cada funcionário sem necessidade.

Cada funcionário deve possuir seu próprio workspace lógico e armazenamento persistente autorizado.

### Testes obrigatórios

- Conectar um MCP de teste.
- Descobrir ferramentas.
- Executar ferramenta somente por funcionário autorizado.
- Recusar funcionário não autorizado.
- Solicitar aprovação de uma ferramenta sensível.
- Aprovar a operação.
- Executar a operação uma única vez.
- Gerar um arquivo.
- Recuperar o arquivo pela interface.
- Executar comando em sandbox.
- Navegar utilizando browser isolado.
- Impedir acesso indevido ao host e a credenciais.

## 12. ETAPA 6 — Funcionários preconfigurados e produto Plugueme

O cliente não deve precisar saber construir agentes, escrever prompts complexos ou configurar frameworks de IA.

Crie uma estrutura reutilizável de templates de funcionários.

Cada template deverá possuir, conforme aplicável:

- Identificador.
- Nome.
- Descrição.
- Cargo.
- Departamento.
- Avatar.
- Instruções.
- Responsabilidades.
- Skills.
- Ferramentas necessárias.
- Integrações recomendadas.
- Rotinas sugeridas.
- Indicadores.
- Permissões.
- Configurações iniciais.
- Versão.

Os templates devem ser versionáveis.

Um funcionário criado a partir de um template deve continuar personalizável.

Não sobrescreva personalizações do cliente automaticamente ao atualizar um template.

### Catálogo inicial

Prepare a estrutura e templates iniciais para:

1. Diretor executivo.
2. Gestor operacional.
3. Gestor de tráfego pago.
4. Social media.
5. Analista financeiro.
6. Assistente comercial.
7. Analista de dados.
8. Assistente de atendimento.

Esses funcionários não devem afirmar possuir acesso a Meta Ads, Instagram, bancos, CRMs ou outras ferramentas que ainda não foram conectadas.

Não invente integrações funcionais.

Quando uma ferramenta necessária não estiver conectada, informe claramente o requisito.

### Onboarding

O usuário deve conseguir:

1. Acessar a plataforma.
2. Configurar sua conta.
3. Conectar um provedor de IA.
4. Escolher um funcionário do catálogo.
5. Configurar as integrações necessárias.
6. Personalizar o funcionário.
7. Iniciar uma conversa.
8. Criar uma tarefa ou rotina.
9. Acompanhar resultados.

A experiência não deve exigir conhecimentos de Docker, MCP, infraestrutura ou programação para as operações comuns.

Configurações avançadas devem permanecer disponíveis para usuários técnicos autorizados.

### Marca

Centralize a identidade visual do Plugueme.

Preserve o layout original como base.

Não redesenhe todo o produto sem orientação visual adicional.

## 13. ETAPA 7 — Administração, provedores, consumo e segurança

### Autenticação

Preserve o Better Auth e os mecanismos existentes.

A aplicação comercial não pode depender de single-user mode inseguro em um servidor público.

Implemente ou preserve:

- Login.
- Logout.
- Sessões.
- Gerenciamento de usuários.
- Papéis.
- Permissões.
- Revogação de sessões.
- Recuperação de acesso, quando disponível.
- Proteção contra ataques de autenticação.

### Permissões

Uma VPS exclusiva por cliente não elimina a necessidade de controle de acesso.

Garanta autorização entre:

- Usuários.
- Funcionários.
- Conversas.
- Grupos.
- Arquivos.
- Memórias.
- Ferramentas.
- Credenciais.
- Aprovações.
- Tarefas.
- Ambientes de execução.

Não permita que um funcionário obtenha acesso às credenciais de outro funcionário sem autorização.

### BYOK

O cliente conecta seus próprios provedores.

Priorize suporte existente a:

- OpenAI.
- Anthropic.
- Google Gemini.
- OpenRouter, quando suportado.
- Endpoints compatíveis, quando suportados.

Não implemente métodos de autenticação de assinaturas pessoais que violem termos aplicáveis.

A aplicação deve inicializar mesmo sem uma chave de IA.

O cliente deve conseguir conectar um provedor posteriormente.

Permita configurar modelos por funcionário, respeitando as capacidades disponíveis.

### Consumo de IA por funcionário

Implemente medição local por:

- Funcionário.
- Provedor.
- Modelo.
- Execução.
- Task.
- Rotina.
- Período.

Registre, quando disponibilizado pelo provedor:

- Tokens de entrada.
- Tokens de saída.
- Tokens em cache.
- Chamadas.
- Erros.
- Duração.
- Consumo associado às execuções.

Custos monetários devem ser apresentados como estimativas quando não houver faturamento real retornado pelo provedor.

Não invente dados de consumo.

Não confunda limites de tokens por resposta com limites financeiros globais.

Permita configurar limites operacionais, tais como:

- Máximo de tokens.
- Máximo de chamadas.
- Máximo de etapas por execução.
- Tempo máximo.
- Concorrência.
- Orçamento estimado por funcionário.

Implemente prevenção de ciclos entre agentes.

### Logs e auditoria

Preserve os mecanismos originais.

Registre eventos relevantes:

- Login.
- Alteração de funcionário.
- Configuração de credencial.
- Execução.
- Delegação.
- Aprovação.
- Utilização de ferramentas.
- Alterações externas.
- Erros.
- Operações administrativas.

Não registre segredos ou conteúdos sensíveis desnecessariamente.

### Segurança geral

Revise:

- SSRF.
- XSS.
- CSRF.
- CORS.
- Autorização.
- Sessões.
- Isolamento.
- Upload.
- Downloads.
- WebSockets.
- Egress de rede.
- MCPs.
- Execução de comandos.
- Segredos.
- Dependências.
- Prompt injection.
- Conteúdo não confiável.

Preserve mecanismos de proteção existentes.

Não desative validações para fazer testes passarem.

## 14. ETAPA 8 — Docker, distribuição e operação

Crie uma distribuição de produção exclusivamente web.

Utilize Dockerfiles próprios e código-fonte adequadamente licenciado.

A distribuição poderá conter:

- Servidor Plugueme com frontend compilado.
- PostgreSQL.
- Worker, quando necessário.
- Supervisor de ambientes isolados.
- Imagens dos computadores dos funcionários.
- Proxy reverso, quando necessário.

Não force todos os componentes a rodarem dentro de um único container se isso comprometer segurança ou manutenção.

O objetivo é um pacote de implantação reproduzível, não necessariamente um único processo.

### Imagens

Utilize builds multi-stage.

Remova do artefato final:

- Ferramentas de desenvolvimento desnecessárias.
- Testes.
- Arquivos de configuração de desenvolvimento.
- Credenciais.
- Source maps públicos.
- Aplicativos desktop.
- Aplicativos mobile.
- Extensão.
- Documentação interna desnecessária.
- Componentes fora do escopo.

Utilize código compilado ou empacotado quando tecnicamente apropriado.

Execute processos com usuário não root quando possível.

Não publique código ou imagens em registries externos sem autorização.

### Docker Compose

Crie uma configuração de produção documentada.

Inclua:

- Health checks.
- Restart policies.
- Redes internas.
- Volumes persistentes.
- Configuração de recursos.
- Segredos.
- Dependências de inicialização.
- Migrations.
- Logs.
- HTTPS por proxy reverso.
- Configuração de domínio.
- Banco não exposto publicamente.

### Backup

Implemente procedimento de backup para:

- PostgreSQL.
- Arquivos.
- Workspaces persistentes.
- Configurações.
- Dados dos funcionários.
- Credenciais criptografadas.

A chave de criptografia necessária à restauração deve possuir backup seguro e separado, com acesso restrito.

Não inclua segredos em backups desprotegidos.

Teste efetivamente a restauração em uma instalação limpa.

Não considere backup validado apenas porque um arquivo foi gerado.

### Atualizações

Documente:

- Versionamento de imagens.
- Atualização de containers.
- Backup anterior à atualização.
- Migrations.
- Compatibilidade.
- Health checks.
- Rollback.

Não prometa rollback automático de migrations destrutivas.

### Independência

Valide uma instalação limpa sem:

- CopilotKit Intelligence.
- CopilotKit License Token.
- Intelligence API Key.
- Login CopilotKit.
- Composio.
- Arcade.
- Containers proprietários obrigatórios.

Revise egress para confirmar ausência de chamadas proprietárias obrigatórias.

Não bloqueie provedores de IA e ferramentas que foram autorizados pelo cliente.

## 15. Qualidade e testes

Mantenha os testes existentes.

Não enfraqueça configurações de TypeScript.

Não utilize any indiscriminadamente.

Não silencie falhas para declarar sucesso.

Investigue os erros preexistentes do typecheck global e diferencie-os dos erros introduzidos por novas alterações.

Corrija prioritariamente regressões e erros que afetam a distribuição web.

Execute a cada etapa:

- Testes standalone.
- Testes de regressão relevantes.
- Testes novos.
- Typecheck de produção.
- Typecheck dos testes.
- Build frontend.
- Build backend.
- Biome.
- Migrations, quando modificadas.
- Testes de integração com PostgreSQL.

Utilize mocks de provedores nos testes automatizados.

Não gaste créditos de IA desnecessariamente.

Existe um orçamento anteriormente informado de US$3 para testes reais. Não assuma que o saldo continua disponível. Utilize chamadas reais somente quando necessárias e autorizadas.

Os testes devem diferenciar:

- Funcionalidade real.
- Provedor simulado.
- Teste unitário.
- Teste de integração.
- Teste end-to-end.
- Funcionalidade não validada.

Não apresente mocks como evidência de funcionamento de um provedor real.

## 16. Ambiente de desenvolvimento

Preserve a instalação de referência original.

Preserve os dados e containers de outros projetos.

O ambiente independente anteriormente documentado utiliza:

- Porta HTTP 3031.
- PostgreSQL 5544.
- Projeto Compose openbot-independent.
- Arquivo .env.standalone.
- Volume independente.

O comando documentado anteriormente é:

rtk proxy bun run start:standalone

Confirme se essas configurações ainda são válidas.

Não imprima .env, tokens, credenciais ou configurações privadas.

Não remova volumes existentes.

Não execute comandos destrutivos sem necessidade e autorização.

Não faça push remoto sem autorização.

Crie commits locais pequenos e descritivos quando concluir marcos funcionais.

## 17. Estratégia de execução

Trabalhe autonomamente.

Não fique solicitando que eu execute comandos que você consegue executar diretamente.

Não pare após produzir uma auditoria.

Não reinvente o produto.

Execute o desenvolvimento por etapas.

Antes de iniciar cada etapa:

1. Inspecione a implementação atual.
2. Identifique o que pode ser reaproveitado.
3. Identifique dependências.
4. Defina critérios de aceitação.
5. Implemente.
6. Teste.
7. Corrija erros.
8. Documente.

Não avance para uma etapa posterior deixando regressões críticas na etapa atual.

Dentro de cada etapa, faça alterações pequenas e verificáveis.

Se encontrar um bloqueio, investigue e resolva quando estiver dentro do escopo.

Solicite intervenção somente para:

- Credenciais realmente necessárias.
- Decisões comerciais irreversíveis.
- Operações externas com consequências.
- Permissões ausentes.
- Riscos significativos de perda de dados.
- Decisões visuais definitivas não especificadas.

Se o contexto da sessão ficar próximo do limite, atualize a documentação de continuidade antes de encerrar.

## 18. Documentação obrigatória

Crie o documento principal:

docs/PLUGUEME-V1-SCOPE.md

Esse documento deve conter o escopo definitivo definido neste prompt.

Crie ou mantenha:

- docs/implementation-progress.md
- docs/independence-audit.md
- docs/standalone-architecture.md
- docs/standalone-test-report.md
- docs/plugueme-roadmap.md
- docs/plugueme-feature-matrix.md
- docs/plugueme-security.md
- docs/plugueme-deployment.md
- docs/plugueme-backup-restore.md

A feature matrix deve classificar cada funcionalidade como:

- Implementada.
- Validada.
- Parcial.
- Pendente.
- Fora do escopo.
- Removida da distribuição.

Documente as evidências para cada classificação.

Não marque uma funcionalidade como concluída apenas porque existem arquivos relacionados a ela.

Mantenha implementation-progress.md atualizado com:

- Branch.
- Commit.
- Etapa atual.
- Arquivos modificados.
- Decisões.
- Testes.
- Resultados.
- Problemas conhecidos.
- Pendências.
- Próximos comandos.

A próxima sessão de IA deve conseguir continuar sem reconstruir todo o contexto.

## 19. Critérios finais de aceitação da V1

A V1 será considerada tecnicamente pronta quando:

- Uma VPS limpa conseguir executar nossa distribuição Docker.
- O usuário conseguir acessar pelo navegador.
- A interface preservar a experiência original personalizada.
- Usuários conseguirem autenticar.
- Usuários conseguirem conectar provedores de IA.
- Funcionários personalizados puderem ser criados.
- Funcionários preconfigurados estiverem disponíveis.
- Chats individuais funcionarem.
- Conversas em grupo funcionarem.
- Funcionários conseguirem conversar entre si.
- Funcionários conseguirem delegar tarefas.
- Notificações e mensagens não lidas funcionarem.
- Favoritos e funcionários fixados funcionarem.
- Tasks funcionarem.
- Rotinas funcionarem sem navegador aberto.
- Goals e check-ins funcionarem.
- Aprovações funcionarem.
- Memória individual funcionar.
- Memória compartilhada funcionar.
- Upload e geração de arquivos funcionarem.
- Skills funcionarem.
- MCPs personalizados funcionarem.
- OAuth funcionar.
- Vault funcionar.
- Browser isolado funcionar.
- Terminal isolado funcionar.
- Computadores dos funcionários funcionarem.
- Permissões e isolamento forem validados.
- Consumo por funcionário estiver disponível.
- Logs e auditoria funcionarem.
- Backup e restauração forem testados.
- Não existir dependência obrigatória do Intelligence.
- Não existir dependência obrigatória do Composio ou Arcade.
- Não houver distribuição de aplicativos nativos ou extensões.
- Os testes relevantes estiverem aprovados.
- As limitações restantes estiverem claramente documentadas.

A aprovação técnica não substitui uma revisão de segurança antes de expor a plataforma a clientes reais.

## 20. Fora do escopo — fase futura

Não implemente neste ciclo:

- Automatic Learning.
- Recorder.
- Voz.
- Desktop.
- Mobile nativo.
- Extensão de navegador.
- Composio.
- Arcade.
- Slack.
- Teams.
- Stripe.
- Cobrança recorrente.
- Gestão de assinaturas.
- Provisionamento automático de VPS.
- Marketplace público.
- Control plane central de clientes.

Essas funcionalidades poderão ser discutidas futuramente.

## 21. Início imediato

Comece agora lendo a documentação existente e inspecionando a branch codex/plugueme-intelligence.

Consolide o estado atual no documento PLUGUEME-V1-SCOPE.md.

Crie a feature matrix e o roadmap técnico.

Verifique se houve progresso desde o primeiro marco.

Execute a ETAPA 1, adequando o projeto ao escopo exclusivamente web.

Preserve o chat independente já funcional.

Depois prossiga para o motor de execução e memória.

Não quero apenas uma resposta explicando o que será feito.

Quero alterações reais no código, testes executados, resultados documentados e evolução progressiva do produto.

O objetivo principal é entregar o Plugueme V1 funcional e independente, aproveitando ao máximo o código existente.