# Procedência das implementações do Plugueme V1

Registro: 25/11/2026. Fonte base `6d1919a3`, anterior à remoção pública do backend. Branch `codex/plugueme-intelligence`. Aviso MIT/copyright original preservado. SDK permissivo não concede licença de uso de seu serviço hospedado.

## Método obrigatório

Para cada item: fonte atual → histórico Git → exemplos/testes → dependências permissivas → adaptação → código novo somente para lacunas → teste standalone. Nenhum resultado é validado apenas pela existência de um arquivo.

A instalação de avaliação é referência separada. Não foi extraído, descompilado nem reutilizado código proprietário. A autorização genérica de estudo não substitui os termos aplicáveis: o próprio complemento proíbe extração/descompilação proprietária, e essa restrição é preservada. Metadados operacionais, configurações sem segredos e contratos públicos bastam para o trabalho atual.

## Origem por funcionalidade

| Funcionalidade | Fonte permissiva existente / histórico | Evidência e dependência | Decisão |
| --- | --- | --- | --- |
| Threads, mensagens, SSE, replay | Novos `standalone/store.ts`, `runner.ts`, migration 0092; contratos públicos AG-UI; runtime MIT | AG-UI 1.0.2, runtime 1.85.0; testes standalone de store/runner/app | Preservados. O primeiro commit `f238ce97` já usava Intelligence; não foi localizada ali uma implementação antiga de transcript local a restaurar. |
| Memória individual | `memory/store.ts`, `runtime.ts`, `tools.ts`, schema memory; `4c25119d^`, antes da migration 0054 | MIT da raiz; `memory-store.integration.test.ts`, `memory-intelligence.integration.test.ts` | Usar o fallback local atual. Não restaurar versão antiga por cima de correções posteriores. CRUD e middleware de contexto integrados ao standalone sem cliente Intelligence. `quoteMemoryContext` e `retrieve` reutilizados; fontes conectadas explicitamente indisponíveis até MCP. |
| Conhecimento compartilhado | Memória, fontes, Skills e grants existentes; scope de memória atual é pessoal | Drizzle/PostgreSQL; investigar ACL/grants antes de migration nova | Não reinterpretar memória pessoal como corporativa. Camada compartilhada autorizada ainda pendente. |
| Tasks e execução durável | `tasks/`, `work/`, `toolkit/src/run-turn.ts` | MIT; testes task/goal/run-turn existentes | Adaptar admissão/histórico para o mesmo LocalAgentRunner; nenhum segundo motor. |
| Rotinas/CRON/fusos | `routines/`, `worker/`, schema coworker; commits `69c8b0ae`, `558cba6e` | MIT; testes routine/sweep/worker | Reutilizar agendamento, claims e histórico; trocar apenas integração de execução. |
| Goals/check-ins | `responsibilities/`, `proactive/` e migrations | MIT; testes goal/proactive e fila de trabalho | Reutilizar limites e políticas. Integração pendente. |
| Comunicação/delegação/grupos | `agents/handoff*`, `subagent.ts`, `group/`, `delivery/`, `channels/`, `team-bots/` | MIT; testes handoff/group/delivery | Usar os mesmos grants e limites contra ciclos. Não trazer Slack/Teams. |
| MCP/OAuth | `plugins/`, `remote-oauth-config`, migration 0091; commit `7edbacc0` | MCP SDK MIT 1.30.0; testes remote-mcp/oauth/plugin | Preservar SSRF, state, PKCE, vault e grants; não incorporar broker externo. |
| Skills manuais | `plugins/skills*`, schema plugins, templates existentes | MIT; testes skills e grants | Separar de Automatic Learning/Recorder, que estão fora do escopo. |
| Aprovações/políticas | `approvals/`, `computer/policy*`, grants | MIT; testes approval/continuation/native-approval | Reaproveitar ação concreta, ator e estado durável; não executar antes de aprovação. |
| Arquivos | `channels/attachments*`, schema attachments, computador/workspace | MIT; testes anexos, caminhos e limites | Reutilizar autorização, limites e validações; integração pendente. |
| Computador/browser/terminal | `agent-computer/`, `supervisor/`, `computer/`, `spire/`, Dockerfiles | MIT dos fontes da raiz; dependências de imagem ainda exigem auditoria final | Compilar imagens próprias. Não usar imagem proprietária apenas porque existe no host. |
| Login/roles/Vault | `auth/`, `request-actor.ts`, `credentials.ts`, guards | Better Auth 1.7.1 MIT, testes de auth/credentials | Usados pelo composition root; produção deve configurar autenticação, não single-user público. |
| Uso/logs/auditoria | `model_usage`, `telemetry/product*`, `audit.ts`, scrubbing | MIT; schemas/testes existentes | Reutilizar armazenamento local, sem sink proprietário. Medição por funcionário pendente. |
| Interface e marca | `app/`, `shared/`, `tenant-package.ts`, `generate-app-config.ts`, CSS/tokens existentes | MIT; React/Vite; testes de UI existentes | Preservar componentes. Reutilizar configuração de tenant/brand; não inventar logo/cores finais. |
| Capacidades web | Novo `shared/product-capabilities.ts`; endpoint existente `/api/capabilities` | Código próprio sobre abstração MIT existente | Acrescenta estado de produto separado de autorização. Recursos pendentes não retornam listas fictícias. |
| Backup/restauração | PostgreSQL, volumes de workspace e chave do Vault | Ferramentas nativas PostgreSQL; procedimento ainda não validado | Implementar/testar na etapa operacional; não declarar backup pronto. |

## Versões e licenças verificadas nos manifests instalados

| Componente | Versão | Licença declarada | Responsabilidade |
| --- | --- | --- | --- |
| `@copilotkit/runtime` | 1.85.0 | MIT | Runtime de agentes/SSE open source, sem Intelligence no modo local |
| `@ag-ui/client` | 1.0.2 | MIT | Eventos, cliente e abstração de agente |
| `@modelcontextprotocol/sdk` | 1.30.0 | MIT | Protocolo MCP |
| `better-auth` | 1.7.1 | MIT | Sessões/autenticação |
| `drizzle-orm` | 0.45.2 | Apache-2.0 | Schemas/query/migrations |
| `@mastra/core` | 1.64.0 | Apache-2.0 | Adaptador/runtime existente |
| `@composio/core` | 0.18.1 | ISC | SDK presente no legado, fora da distribuição V1 pretendida |
| `@arcadeai/arcadejs` | 2.4.1 | MIT | SDK presente no legado, fora da distribuição V1 pretendida |

Não é uma auditoria transitiva completa. O inventário foi lido dos manifests locais, sem consultar implementação privada de serviços. Licenças de React, Bun, Vite, imagens base e dependências transitivas devem constar do inventário final de distribuição, com respectivos notices.

## Containers observados (somente metadados)

- Independente: `openbot-independent-postgres-1`, imagem `pgvector/pgvector:pg17`; `postgres --version` informa PostgreSQL **17.12**. Banco em 5544; volume exclusivo. PostgreSQL/pgvector são componentes open source, mas o inventário final da imagem deve preservar os avisos de todas as camadas.
- Referência: `openbot-server-1` (`openbot:main`, reiniciando), `openbot-agent-computer-1`, `openbot-supervisor-1`, adaptadores LangGraph e PostgreSQL em 5432. Origem/licença exata das imagens locais não foi inferida do nome; **não incorporadas** à distribuição independente.
- Cluster de avaliação: dois containers k3d com imagens identificadas por hash. Conteúdo proprietário não inspecionado ou extraído. Versão/licença do serviço de avaliação não comprovadas nesta auditoria; fora da distribuição.
- `honorarios-*`: outro projeto, preservado e fora de análise funcional.

`/Users/pablo/Downloads/download.svg` foi lido apenas como referência visual fornecida pelo usuário. Não foi incorporado como logo nem utilizado para substituir o layout original; a licença de redistribuição desse arquivo não foi presumida.
