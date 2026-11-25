# Matriz de funcionalidades Plugueme V1

25/11/2026. “Validada” exige execução observada/teste relevante; arquivo existente não basta. A disponibilidade de produto da API é separada do nível de validação desta matriz.

| Funcionalidade | Estado | Evidência / lacuna |
| --- | --- | --- |
| Inicialização independente, PostgreSQL e UI original | Validada | Marco anterior: health, HTML, runtime SSE, banco separado e reload/reinício |
| Chat individual/streaming/histórico/reconexão | Validada | Resposta real anterior; testes standalone sem provedor pago |
| Criar funcionário | Validada | API original 201 e visualização no navegador |
| Editar/excluir/duplicar/arquivar | Parcial | Stores/rotas originais; falta cobertura end-to-end standalone para todas as operações |
| Favoritos/fixados/ocultos | Parcial | Preferências locais existentes; validar no produto web |
| Funcionários preconfigurados | Parcial | Dois exemplos originais; catálogo de oito templates Plugueme pendente |
| Grupos e autoria | Pendente | Fonte group/channels existente, sem wiring standalone |
| Comunicação e delegação entre funcionários | Pendente | Handoff/subagent/delivery existentes; adaptar runner |
| Notificações internas/não lidas | Parcial | Activity/read markers locais; atenção/worker ainda não conectados |
| Tasks/rotinas/CRON/fusos/worker | Parcial | Mesmo runner PostgreSQL do chat, cron/fusos e worker local conectados; teste completo de rotina e tarefa de item existente passou. Criação manual disponível pelo botão New task em Bots, com retry idempotente; goals/check-ins e ferramentas externas ainda pendentes |
| Goals/check-ins/segundo plano | Pendente | Store/engine originais não conectados ao composition root |
| Memória individual | Parcial | CRUD pessoal e contexto no chat conectados ao PostgreSQL; persistência após restart e desabilitação validadas. Fontes MCP e gravação pelo modelo ainda pendentes |
| Memória compartilhada/conhecimento | Pendente | Definir ACL e escopo corporativo sem vazar memória pessoal |
| Skills manuais | Pendente | Store/grants/importação existentes; separar Learning |
| Upload/geração/download de arquivos | Pendente | Anexos e computador existentes; endpoints/workspaces não conectados |
| MCP remoto/OAuth/discovery/grants | Pendente | SDK/rotas/migration 0091 existentes; sem brokers na V1 |
| Vault criptografado/rotação/revogação | Parcial | Gravação real anterior e resposta sem plaintext; validar ciclo completo |
| Aprovações humanas/políticas | Pendente | Implementação local madura; adaptar execução e retomada |
| Browser/terminal/computador isolado | Pendente | Fontes recuperadas; construir/testar imagens próprias |
| Login/logout/sessões/usuários/roles | Parcial | Better Auth/guards existentes; ambiente local é single-user restrito |
| OpenAI BYOK | Validada | Uma conversa real no marco anterior; não repetida nesta etapa |
| Anthropic/Gemini/OpenRouter/endpoints compatíveis | Parcial | Suporte varia por componente; confirmar configuração e runtime antes de prometer |
| Seleção de modelo por funcionário | Pendente | Catálogo/choices existentes, wiring local pendente |
| Consumo por funcionário/limites financeiros | Pendente | Schema model_usage existe; limite de saída não equivale a orçamento |
| Logs/auditoria | Parcial | Stores originais usados; cobertura de execução/delegação ainda incompleta |
| Capacidades centrais/estados de indisponibilidade | Implementada | Registro compartilhado + API + guard de rotas + navegação; testes desta etapa em execução |
| Identidade visual central | Parcial | Tenant brand/config/tokens existentes; identidade final não aprovada |
| Docker próprio/implantação VPS/HTTPS | Pendente | Compose de banco local não é distribuição de produção |
| Backup/restauração | Pendente | Nenhuma restauração limpa validada |
| Testes/typecheck | Parcial | Produção passou no marco anterior; typecheck global de testes possui erros conhecidos |
| Voz/ditado, Recorder, Automatic Learning | Fora do escopo | Retirados das capacidades e da experiência web em andamento |
| Composio/Arcade/Slack/Teams | Fora do escopo | Sem wiring no standalone; legado preservado para não romper código compartilhado |
| Desktop/mobile nativo/extensão | Fora do escopo | Não iniciar/distribuir; fontes legadas ainda no repositório |
| Cobrança/Stripe/control plane/provisionamento | Fora do escopo | Fase futura |

“Removida da distribuição” só será atribuída após verificar o artefato final. Ocultar navegação não comprova eliminação de dependências/chunks.
