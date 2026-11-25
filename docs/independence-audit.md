# Auditoria de independência

Atualização: 25/11/2026. Auditoria inicial; a independência da aplicação completa ainda não foi atingida.

## Base confirmada

- Diretório: `OpenBot-FullSource`; branch existente `plugueme/standalone`, inicialmente limpa.
- HEAD inicial: `6d1919a3b53a0730894258f197f3beb4e8db4f2f`, exatamente o primeiro pai de `f71b0f4b`.
- O commit que remove o backend **não** é ancestral desta branch. Nenhum merge da main foi feito.
- Presentes: server/src, server/tests, migrations 0000–0091, agent-computer, supervisor, worker, toolkit, app, shared, desktop, mobile, extension e adaptadores. A missão menciona management-agent, mas esse diretório não aparece nesta árvore; não foi criado artificialmente.
- Bun instalado: 1.4.2; o projeto e as imagens declaram 1.4.3. Compose: v5.1.2. Dependências verificadas com `bun install --frozen-lockfile`, sem mudanças no lockfile.
- O Docker existente usa projeto `openbot`; servidor reiniciando, PostgreSQL/computador/supervisor/adaptadores ativos. Containers `honorarios-*` preservados. Nenhum container foi parado ou recriado nesta etapa.

## Fluxos e classificação

| Responsabilidade | Evidência no código | Classificação e decisão |
| --- | --- | --- |
| Configuração de boot | `server/src/config.ts`, `runtimeCapabilities` exige API URL, gateway URL e chave | Obrigatória hoje. Substituir por união discriminada de modos, sem inventar URLs/chaves locais de Intelligence. |
| Runtime de chat | `server/src/copilot.ts`, `mountCopilotRuntime` constrói cliente Intelligence e CopilotRuntime | Obrigatória hoje. O SDK instalado também exporta `CopilotSseRuntime`, `AgentRunner` e `InMemoryAgentRunner`; usar runner PostgreSQL próprio no ramo SSE. |
| Histórico | `copilot.ts` retorna `history` a partir de `getThreadMessages`; `toolkit/src/run-turn.ts` lê as mesmas mensagens | Falta armazenamento local equivalente para chat direto. Implementado store novo, ainda não ligado a esses consumidores. |
| Thread e concorrência | `toolkit/src/copilotkit/thread-lock.ts`, `toolkit/src/run-turn.ts`, métodos acquire/renew/cleanup do cliente | Substituir pelo lease PostgreSQL e identidade imutável da thread. Compartilhar admissão entre chat e execução headless. |
| Streaming/reconexão | `intelligence-gateway-proxy.ts`; runtime Intelligence devolve dados de ingresso no gateway | Substituir por SSE e replay dos eventos locais. Não construir gateway que finja ser o serviço licenciado. |
| Rotinas, objetivos e tarefas | `server/src/routines`, `tasks`, `responsibilities`, `work`; `worker/src/index.ts` | Os registros/agendamentos são locais. A execução headless em `index.ts` ainda constrói `IntelligenceAgentRunner`; persistir uma rotina não prova execução independente. |
| Memória | `memory/store.ts`, `memory/runtime.ts`, `db/schema/memory.ts` | Já há fallback PostgreSQL sem cliente remoto. Reutilizar fontes, permissões, opt-outs e memória por agente. Não adicionar embeddings obrigatórios. |
| Automatic Learning | `learning/auto-assign.ts`, `ensure-container.ts`, `runtime.ts`, `routes.ts`, `index.ts` | Container, proposta e publicação dependem do serviço. Desativar explicitamente no standalone inicialmente; manter Skills locais. Ainda falta conectar esse estado à UI. |
| Entitlement | `intelligence-client.ts`, `intelligence-entitlement-check.ts`, `intelligence-startup.ts` | A consulta de boot é informativa; não é o único bloqueio. Não substituir sua resposta por uma licença válida falsa. |
| Canais externos | `db/schema/delivery.ts`, `delivery/*`, `intelligence_channel_mappings` e wiring em `index.ts` | Outbox/inbox/bindings são locais, transporte/transcript ainda tem dependências remotas. Validar por adaptador. |
| Composio | `scripts/start.sh`, `scripts/setup-composio.ts`, `plugins/composio-adapter.ts` | SDK opcional, serviço externo. Startup agora só provisiona com `OPENBOT_PROVISION_COMPOSIO=on`; padrão off. Chaves fornecidas continuam funcionando. |
| Arcade | `plugins/arcade-adapter.ts`, `plugins/broker.ts` | Serviço opcional com credencial própria; preservar seleção explícita. SDK permissivo não torna o serviço independente. |
| MCP | `plugins` e migration 0091, MCP SDK | Implementação nativa existente. Preservar políticas de host, grants, credenciais e OAuth; execução real ainda não testada nesta etapa. |
| Provedores BYOK | `credentials.ts`, `model-catalogue.ts`, `provider-oauth.ts`, `routing/model.ts` | Preservar Vault e resolução de chave no servidor. Não foi feita chamada real de IA. Boot sem chave ainda requer teste depois da integração. |
| Computadores | `agent-computer`, `supervisor`, `computer/*`, `spire` | Fonte recuperada presente. Manter supervisor e isolamento; nenhum socket Docker novo foi exposto. Falta build/execução independente validada. |
| Imagens | `Dockerfile`, `server/Dockerfile`, `supervisor/Dockerfile`, `docker-compose.yml` | Há builds a partir da fonte. Os containers já ativos são de outra execução e não comprovam build deste checkout. Auditar os perfis opcionais antes do pacote final. |
| Frontend | `app/src/lib/copilot/provider.tsx`, `bot-thread.ts` | Interface preservada; o contrato de existência/histórico e o transporte precisam apontar para o backend local. Build passou; navegação autenticada ainda não testada. |
| Telemetria | `server/src/telemetry`, SDK runtime `dist/v2/runtime/core/runtime.mjs`, configuração da raiz | Há sink CopilotKit e telemetria no SDK. Auditar opt-out antes de declarar ausência de egress proprietário. Não basta remover a chave de Intelligence. |

## Licenças verificadas localmente

Aviso MIT da raiz (copyright CopilotKit 2026) preservado. `server/package.json` também MIT.
Metadados dos pacotes instalados: runtime CopilotKit, AG-UI, Better Auth, MCP SDK e Arcade SDK: MIT; Drizzle e Mastra: Apache-2.0; Composio SDK: ISC.
Isso é uma verificação inicial dos componentes centrais, não uma auditoria exaustiva de todas as dependências transitivas/imagens. Nenhum novo serviço ou pacote foi incorporado. Licenças de serviços hospedados são distintas das licenças dos SDKs.

## Próximas verificações obrigatórias

Inventário completo de egress HTTP/WebSocket e telemetria, callbacks OAuth e todos os consumidores de transcript; identificação de dependências transitivas; teste da aplicação com domínios proprietários bloqueados. O guard de rede da suíte existente ajuda a isolar testes, mas não substitui uma verificação de egress da aplicação implantada.
