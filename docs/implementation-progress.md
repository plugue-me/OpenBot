# Continuidade da implementação independente

## Executor headless, tarefas e rotinas locais — 25/11/2026

Reaproveitados `tasks/{store,runner,turn,routes}`, `routines/{store,runner,routes,sweep,schedule}`, fila `work_items`, lifecycle/activity e helpers MIT do toolkit. O adaptador `standalone/turn.ts` executa no mesmo LocalAgentRunner do chat, sem cliente Intelligence. Registry id atribuído antes da execução, admissão original, isolamento de dono/agente, contexto persistido, lease, cancelamento, deadline e resultado durável compartilhados. Encerramento coordenado aborta providers e espera escritas/resultados antes de fechar PostgreSQL. O worker standalone executa sweep a cada 30 s, sem browser. Cada pass considera uma rotina e mantém a lease da fila por mais que o deadline máximo do turno.

Rotas/UI de rotinas habilitadas para agendas. Metas/check-ins continuam bloqueados, sem consultas opcionais ou escolhas inexistentes no formulário. Tarefas existentes podem executar, listar, concluir/reabrir e tentar novamente pela fila original. Início a partir de item existente foi validado; criação manual de tarefas e geração de itens por check-in ainda pendentes. Headless só admite funcionários built-in; agentes externos, ferramentas MCP/computador e continuação de aprovações ainda não são habilitados.

Validação: 12 testes em quatro suítes standalone (77 assertions), incluindo built-in real com OpenAI local simulado; 114 regressões existentes de tarefas/cron/sweep (543 assertions); 68 testes de formulário/discovery (264 assertions). Há testes sobrepostos a seleções anteriores; não somar como total único. Backend typecheck e build web passaram. Typecheck global dos testes continua em 223 diagnósticos, sem apontamentos nos novos testes/arquivos standalone. Tela de agenda conferida em 3031, opções limitadas a schedule. Nenhuma chamada paga, nenhuma extração proprietária, nenhuma migration nesta etapa.


## Memória local conectada — 25/11/2026

Reutilizados `createMemoryStore`, `createMemoryRoutes`, `quoteMemoryContext` e o middleware original do resolver para oferecer CRUD pessoal e contexto de memória no standalone. Nenhum cliente Intelligence ou broker é construído. Memórias manuais são pessoais e chegam aos funcionários desse usuário; memórias formadas por funcionário mantêm o filtro original por bot, e importações não são incluídas sem fonte autorizada. Isso não implementa conhecimento compartilhado da empresa. Gravação por ferramenta do modelo e fontes MCP continuam pendentes.

A seleção final tem 41 testes aprovados (139 assertions), incluindo memória no turno HTTP simulado, persistência após reconstrução do servidor e retirada do contexto após desabilitação. Backend typecheck e frontend build passaram. Tela Memory conferida no servidor local 3031 após reinício; nenhuma chamada paga de IA. Fontes recebem 503 e a interface explicita desenvolvimento.


## Etapa Plugueme V1 — capacidades web (25/11/2026)

A especificação integral está em `PLUGUEME-V1-SCOPE.md`. O reaproveitamento e as licenças estão em `implementation-provenance.md`; roadmap, matriz funcional, segurança, implantação e backup possuem documentos próprios `plugueme-*.md`.

Implementada a fronteira de capacidades do produto, compartilhada pelo servidor e pela interface. No standalone, recursos fora de escopo respondem 404 e recursos em desenvolvimento respondem 503 com estado explícito. Navegação, acesso direto às telas, ferramentas do chat e widgets respeitam essas capacidades; o composer oferece texto e não consulta o histórico de voz. Plugins de autenticação desktop/mobile ficam desabilitados. A interface original é preservada. O script `build:web` compila somente servidor e frontend web; source maps do build web desabilitados explicitamente. Isso não significa que dependências e chunks de todos os recursos legados tenham sido removidos dos artefatos.

Validação desta etapa: 32 testes selecionados de produto/navegação/composer/voz passaram (195 assertions); 16 testes standalone/store/runner/config/capacidades passaram (91 assertions); outra seleção de 32 testes de UI passou (159 assertions). Há sobreposição entre seleções, portanto não somar como testes únicos. Build frontend e typechecks de produção passaram. O typecheck global dos testes continua falhando em 223 diagnósticos; não está aprovado. Nenhuma chamada paga de IA foi necessária nesta etapa.

Memória, tarefas, rotinas, MCP, computador e execução headless permanecem em desenvolvimento. Investigar e adaptar os stores e testes MIT existentes antes de escrever substitutos. A instalação proprietária de avaliação permanece separada e não foi extraída. A V1 comercial não está concluída nem aprovada para publicação.


Atualizado em 25/11/2026.

## Estado atual — servidor independente integrado

Branch de desenvolvimento: `codex/plugueme-intelligence`, criada de `fc9a9a8f`. A alteração preexistente `.copilotkit/local.json` no `.gitignore` foi preservada. Não modificar a instalação de avaliação nem copiar suas implementações.

**Comando disponível: `rtk proxy bun run start:standalone`.** Servidor independente em `http://127.0.0.1:3031`; PostgreSQL dedicado em 5544, projeto Compose `openbot-independent`, volume `openbot-independent_independent-postgres`. Inicializa fonte Bun/Hono, aplica migrations e serve o frontend original. `.env.standalone` privado (0600), com segredos aleatórios, gerado uma única vez e ignorado pelo Git. Não imprimir esse arquivo.

`standalone-entry.ts` desliga a telemetria pelo opt-out oficial antes de importar o runtime e remove credenciais/endpoints Intelligence do processo. `standalone/bootstrap.ts` usa o runtime SSE MIT, nosso runner PostgreSQL, stores originais de agentes/canais/Vault, guards originais de ator/origem/CORS e política de endpoints de agentes. A composição original com Intelligence continua separada.

**Validação real concluída:** chave OpenAI fornecida pelo usuário salva pelo endpoint original do Vault, criptografada no banco independente. Uma conversa na interface original usou `gpt-4.1-mini`, pediu somente `OK`, recebeu `OK` e preservou pergunta/resposta após reload. Não repetir chamadas pagas sem necessidade; usuário informou orçamento total de US$3. Limite standalone de saída: 256 tokens por etapa, configurável por `STANDALONE_MAX_OUTPUT_TOKENS` (1–8192). Não é um controle global de saldo; não afirmar custo exato sem faturamento.

O teste HTTP automatizado usa agente AG-UI simulado local: criação pela API, credencial sintética com resposta sem plaintext, SSE, histórico, reconstrução do servidor e reconexão sem novo run, próximo turno com contexto restaurado. Três suítes standalone: **11 pass / 72 assertions**. Regressão config/copilot/thread-routes/thread-status: **291 pass / 679 assertions**. Backend e frontend compilaram. Biome passou antes dos últimos ajustes, repetir nos arquivos finais.

Typecheck de toda a árvore de testes falha em numerosos testes antigos (stubs incompletos, tipos de fetch, argumentos legados). Não há diagnósticos nos arquivos `standalone` na saída salva em `/tmp/openbot-standalone-test-types.log`; não declarar essa checagem global como aprovada. Typecheck do backend de produção passou.

**Ainda indisponíveis neste marco:** tasks, rotinas, goals/check-ins, memória conectada ao chat, Learning, Recorder, MCP/ferramentas, computador/navegador e arquivos de agentes. A interface mantém as telas e mostra aviso global de indisponibilidade; algumas telas/widgets opcionais ainda exibem avisos de API indisponível (ex.: histórico de voz, Needs you). Não apagar telas nem fingir listas vazias para ocultar limitações.

Próximos passos: tratar widgets opcionais por capacidades; ligar memória local já existente; compartilhar leases/histórico com execução headless; avançar rotinas/tasks/MCP/aprovações e computador apenas após testes. Construir imagem própria com as fontes (não feita nesta etapa), revisar todas as saídas de rede e fazer validação de egress em ambiente separado. O guard de rede da suíte bloqueia destinos não locais, mas não prova sozinho o egress da aplicação inteira em produção.

Validação final após limite de tokens e reconexão vazia: **14 pass / 76 assertions** em quatro suítes standalone; typecheck de produção passou novamente. O campo `RuntimeModel.maxOutputTokens` é opcional e só é preenchido pela composição standalone; a composição original mantém seu comportamento. A conexão de uma thread ainda não criada retorna replay vazio, enquanto uma thread de outro proprietário continua recusada.

Commit funcional: `c5d26cd9` (usar `git log` para hash completo). Após esse commit, reiniciado somente o processo independente e recarregada a conversa real no navegador: pergunta e `OK` continuaram visíveis, sem enviar outra mensagem ao provedor. A sessão atual deixa o servidor em execução na 3031. A única alteração preexistente que deve continuar fora dos commits é `.gitignore` com `.copilotkit/local.json`.

Arquivos deste marco: `server/src/standalone-entry.ts`, `server/src/standalone/bootstrap.ts`, `server/src/standalone/runner.ts`, `server/src/config.ts`, `server/src/copilot.ts`, `server/src/app.ts`, `server/src/http-server.ts`, `server/src/recorder/wiring.ts`, `scripts/start-standalone.ts`, `docker-compose.standalone.yml`, `package.json`, `app/src/lib/copilot/provider.tsx`, `app/src/lib/deployment/queries.ts` e testes standalone de app/config/runner. Nenhuma imagem proprietária foi extraída ou adaptada.

## Registro da etapa anterior (superado pelo estado acima)

## Base e alterações

Branch `plugueme/standalone`, HEAD inicial `6d1919a3` (pai da remoção `f71b0f4b`). Árvore estava limpa. Sem atualização de upstream, push, alteração de licença, remoção de volumes ou reinício de containers.

Implementado:

- Auditoria inicial em `independence-audit.md`, com distinção entre componentes locais e serviços.
- Schema e migration 0092 para threads/runs/eventos locais; snapshot Drizzle gerado pela ferramenta, schema incluído no barrel e drizzle.config.
- Store transacional com lease, identidade imutável, cursores e proteção de execuções antigas/repetidas.
- `LocalAgentRunner`: execução AG-UI independente, replay do banco e cancelamento com verificação de proprietário/runId.
- Dez testes de integração reais com PostgreSQL e agentes simulados.
- `OPENBOT_PROVISION_COMPOSIO=off` por padrão no startup, preservando credenciais fornecidas. Suíte existente de provisionamento agora opta explicitamente por ele; teste novo confirma que startup comum não provisiona.

## Ambiente

Bun host 1.4.2, projeto 1.4.3. Docker Compose 5.1.2. PostgreSQL do projeto existente em 5432. Criado `openbot_standalone_test`, aplicadas migrations 0000–0092 **somente nele**. Nenhum dado da aplicação foi migrado.

Servidor Docker existente em restart; outros componentes OpenBot ativos nas portas 4100/4201/4215/4500. Containers de outro projeto em 8080/9000 preservados. Não imprimir `.env`, credenciais ou ambiente de containers ao continuar.

## Validação

Instalação congelada, typecheck do backend, build do frontend e migrations passaram. Store+runner: 10 pass, 0 fail, 51 assertions. Biome passou nos novos módulos/testes. Ver `standalone-test-report.md` para escopo e falha corrigida.

Scripts `start-restart-guard.test.ts` e `setup-composio.test.ts`: 58 pass, 0 fail, 224 assertions (inclui startup sem provisionamento). `git diff --check` passou.

## Próximo trabalho concreto

**Não considerar o modo standalone pronto.** `config.ts` ainda exige Intelligence e `index.ts`/`copilot.ts` ainda constroem clientes remotos. O runner novo não está no wiring principal. Não tentar resolver isso com dummy tokens ou fake entitlement.

1. Introduzir união discriminada no runtime config e adaptar todos os consumidores de `config.runtime.intelligence`.
2. Conectar o mesmo store/runner ao chat SSE e headless; adaptar `toolkit/src/run-turn.ts` sem perder admission, lease renewal, aprovações e políticas.
3. Adaptar endpoints de histórico, recuperação de thread e estados; o SDK exige métodos síncronos em `LocalThreadEndpointRunner`, portanto o runner PostgreSQL não afirma implementar esse contrato.
4. Deixar Learning/Inspector/Recorder indisponíveis explicitamente; manter memória e Skills locais.
5. Confirmar ausência de egress proprietário, inclusive telemetria; startup sem chave de IA; BYOK posterior na UI.
6. Atualizar health/start/Compose e construir imagens deste checkout; testar interface original, tarefas, rotinas, MCP e isolamento.

Limites do runner atual: um processo executor por instalação; cancelamento não distribuído; replay por polling; sem política de retenção; lease expirada recebe estado persistido de interrupção no próximo claim. Falha de processo não implica retomada automática de efeitos externos.
