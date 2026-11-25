# Arquitetura standalone

## Camada de produto Plugueme V1

`shared/product-capabilities.ts` define estados de recursos e o mapeamento compartilhado de rotas. No modo standalone, `server/src/app.ts` expõe capacidades e aplica bloqueios antes dos handlers; a interface consulta os mesmos estados para navegação, rotas e ferramentas. Capacidades não concedem autorização e não substituem guards de usuário, origem e propriedade. O runtime SSE e o armazenamento PostgreSQL existentes continuam responsáveis pelo chat.

Os plugins de autenticação nativa são excluídos da composição standalone. A composição legada permanece separada. A redução física de dependências e a imagem final web ainda exigem auditoria de distribuição.


Estado em 25/11/2026: persistência/executor integrados num entrypoint independente; conversa real e reload verificados. A composição original com Intelligence permanece separada.

`standalone-entry.ts` prepara o processo sem credenciais remotas/licença e desliga telemetria. `standalone/bootstrap.ts` constrói o runtime SSE MIT com nosso `LocalAgentRunner`, guarda identidade/grants pelo resolver original, reutiliza os stores de agentes/canais e o Vault criptográfico, e monta endpoints assíncronos de histórico no PostgreSQL. `loadConfig` recebe explicitamente as capacidades do modo independente; o caminho original continua exigindo sua configuração original.

As requisições de chat passam por `markAskedRun` e pela política original de encaminhamento de headers e CORS. Isso evita que um turno humano seja confundido com sugestão interna e que credenciais de sessão sejam enviadas a agentes remotos. `createAgentFetch` valida também os redirects. Nenhum entitlement é simulado.

## Implementado

`server/src/standalone/store.ts` usa Drizzle/Bun SQL no PostgreSQL existente, com migration `0092_standalone_conversations`:

- `local_threads`: proprietário e agente imutáveis, snapshot de mensagens/estado.
- `local_runs`: identificador por thread, status, lease e próximo cursor.
- `local_events`: eventos AG-UI JSONB ordenados por thread/run/sequence.

Claim, renovação, gravação e finalização serializam no lock da linha da thread. A concorrência foi testada usando pools independentes. Um runId usado não inicia outra execução. Depois de expirar, o executor antigo não pode renovar, gravar nem finalizar. Um novo claim registra o anterior como interrompido, sem reexecutar ferramentas automaticamente.

`LocalAgentRunner` implementa `AgentRunner` do runtime MIT. A execução começa independentemente da assinatura do Observable. Observadores leem somente eventos persistidos; cancelar a assinatura não para o agente. `connect` restaura eventos sem disparar execução. `stop` exige proprietário e, quando fornecido, runId exato. Cada nova execução restaura mensagens e estado no próprio AbstractAgent antes de `runAgent` (o SDK prepara o input a partir dessas propriedades).

## Limites atuais

O runner é para **um processo servidor** por instalação. O banco protege contra claims de processos concorrentes, mas o cancelamento só alcança o agente mantido nesse processo. A execução de um modelo não sobrevive à morte do processo; histórico/eventos sobrevivem e a lease expira. Não há promessa de execução exatamente uma vez de efeitos externos.

Replay utiliza polling paginado; não requer Redis. Ainda faltam compactação/retenção, testes de carga, shutdown controlado, teste de falha do banco durante streaming e recuperação persistida imediata de leases expiradas sem novo claim. Por enquanto `connect` informa a expiração, e o próximo claim registra a interrupção no banco. Snapshots intermediários refletem o estado antes da aplicação do evento no SDK; snapshot final é capturado após o término. O log de eventos é necessário para recuperação de uma execução interrompida.

O store não substitui a autorização de acesso ao Bot. O host precisa resolver o ator autenticado, grants e Bot autorizado antes de `run`. Além disso o store exige o mesmo proprietário e agente em todas as operações. Não expor `exists` diretamente como API pública.

## Integração planejada

1. `RuntimeCapabilities`: união `standalone`/`intelligence`, sem campos remotos fictícios.
2. Compartilhar store/runner em `index.ts`; adaptar `mountCopilotRuntime` ao ramo SSE mantendo hooks de políticas, aprovações, header denylist e resolver de atores.
3. Adaptar `createTurnRunner` para os mesmos histórico e leases locais. Não deixar rotinas usando outro controle de concorrência.
4. Criar endpoints de histórico/thread assíncronos autenticados. O contrato local do SDK usa métodos síncronos; não declarar essa capacidade no runner PostgreSQL enquanto não houver adaptação correta.
5. Usar memória local existente; desligar Learning/Inspector/Recorder que exigem Intelligence, com capacidades explícitas na interface.
6. Desligar telemetria proprietária, adaptar startup/health e Compose, validar BYOK sem chave e UI original.

Nenhuma resposta de licença ou entitlement foi falsificada. O entrypoint independente seleciona o runner local; o entrypoint original continua com Intelligence. Os itens de integração acima permanecem como roteiro para o segundo marco, especialmente execução headless, memória e recursos opcionais.
