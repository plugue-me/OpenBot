# Relatório de testes standalone

## Integrações Community, terminologia e skin — 25/11/2026

- Skin: store de preferências conectado ao composition root; GET/PATCH/persistência e preservação das demais preferências passaram (2 testes standalone, 36 assertions nesta seleção).
- Executor: 2 testes, 37 assertions, incluindo descoberta em subprocesso real, todos os nove pacotes e entradas recusadas; sem IA paga.
- REST remoto real com chave fictícia: passou pelo Plugueme/Vault/grants/executor/httpbin; após remoção da chave, chamada recusada. Repetido após pinning de IP/TLS para prevenir DNS rebinding; passou também pela imagem Docker final.
- Regressão MCP personalizado + credenciais pessoais + standalone: 21 testes, 109 assertions.
- Interface: 62 testes, 297 assertions em prompt, skin, navegação, roster, aprovações e ferramentas. Expectativas visíveis atualizadas para Agentes, preservando rotas/campos internos.
- Imagem do executor construída/rodada; Compose de produção validado estruturalmente. Implantação completa de produção e contas OAuth de fornecedores ainda não validadas.
- Backend/frontend typecheck e build web passaram durante a implementação; checagem final registrada no commit. Sem testes pagos.
- Verificação do cadastro local em resposta à lista duplicada da conversa: não havia dev/qa no banco; nenhum agente removido. Reforçadas instruções de não tratar texto anterior do modelo como registro salvo e de só confirmar alterações após resultado real de ferramenta. Isso não constitui garantia de eliminar alucinações do modelo.

## MCP e aprovações — 25/11/2026

- Nova integração MCP standalone: **6 pass, 40 assertions**, usando MCP SDK real, PostgreSQL dedicado de teste e LLMock local. Cadastro/discovery, Vault sem plaintext na resposta, grants, rejeição de endereços inseguros, execução autorizada, suspensão, aprovação única, negação, revogação e pausa antes da execução. Nenhuma chamada paga.
- Regressão final de executor/aprovações/políticas e turnos/tarefas standalone: **22 pass, 75 assertions**. Seleção anterior mais ampla: 78 pass, 317 assertions; seleções se sobrepõem e não devem ser somadas.
- Contratos OAuth/conexão/provedor originais: 67 pass, 150 assertions. Não equivale a validar OAuth com fornecedor real.
- UI de ferramentas internas, aprovações e capacidades: seleção final 11 pass, 48 assertions; regressões anteriores de conexões/tarefas 27 pass, 211 assertions. Eventos/listener de canais: 37 pass, 78 assertions.
- Typecheck backend de produção, build web, Biome dos arquivos alterados e diff check passaram. Typecheck global de testes mantém 223 diagnósticos preexistentes; não está aprovado globalmente.
- Sem migration nesta etapa, sem ferramenta/configuração de teste criada no banco local de uso e sem alteração dos containers de avaliação.

## Criação manual de tarefas — 25/11/2026

- Tarefas originais + composição standalone: 24 pass, 141 assertions.
- Fila original + journal de migrations + standalone: 28 pass, 68 assertions.
- Nova tarefa + Needs you + botões de aprovação legados: 17 pass, 169 assertions.
- Cobertura nova: dois POSTs concorrentes geram uma tarefa/um turno; UUID com conteúdo diferente recebe 409; dono no payload é recusado; rollback não deixa work item; confirmação de rede perdida conserva a mesma solicitação no retry da UI.
- Backend typecheck e build web passaram. Typecheck global dos testes continua com 223 diagnósticos, sem apontamentos nos novos arquivos standalone.
- Migration 0093 aplicada em teste e no banco dedicado local. Tela New task e seletor de funcionários conferidos em 3031. Sem chamadas pagas e sem teste gravado no banco de uso local.


## Tarefas/rotinas/headless — 25/11/2026

- `standalone-work`, `standalone-turn`, `standalone-runner`, `standalone-app`: 12 pass, 77 assertions. Cron executado via composição real, built-in/modelo simulado local, resultado no histórico web; tarefa pronta para revisão e resolve/reopen; replay, concorrência, dono estrangeiro, cancelamento, timeout e shutdown durável.
- `routine-run-turn`, `routine-runner`, `routine-sweep.integration`, `routine-run-now.integration`, `tasks.integration`, `tasks-state`: 114 pass, 543 assertions.
- `new-routine-form` + `routines-discovery`: 68 pass, 264 assertions, incluindo standalone sem consulta/oferta de check-ins e metas.
- Backend typecheck e build web passaram. Typecheck global dos testes: 223 diagnósticos preexistentes; sem diagnóstico nos novos módulos/testes standalone. Não está aprovado globalmente.
- Interface local de nova rotina conferida em 3031. Nenhum agendamento de teste salvo no banco de uso local e nenhuma chamada paga de IA.

A validação não cobre criação manual de tarefa, geração de check-ins, ferramentas externas, aprovações ou execução headless em agentes remotos; permanecem pendentes.


## Memória standalone — 25/11/2026

41 testes passaram, 139 assertions, na seleção `standalone-app.integration`, `memory-store.integration`, `memory-runtime`, `memory` e `product-capabilities`. Banco PostgreSQL real de teste, endpoint AG-UI simulado e nenhuma chamada paga. Verificados CRUD pessoal no wiring real, memória enviada ao agente como dados não confiáveis, persistência após restart, remoção do contexto após desabilitação, isolamento original do store e 503 para fontes sem ingestão. Backend typecheck e frontend build passaram; tela Memory acessível em 3031. Isso não valida memória corporativa, fontes MCP ou escrita pelo modelo.


## Validação da camada Plugueme V1 — 25/11/2026

- Produto/capacidades/chat/navegação/composer/voz: seleção de 32 testes passou, 195 assertions.
- Configuração/store/runner/app standalone e capacidades: 16 passaram, 91 assertions, PostgreSQL de teste e provedor simulado.
- Regressão UI (composer anexos, badge, admin, histórico de voz e produto): 32 passaram, 159 assertions. O teste legado de voz informa agora explicitamente capacidades legadas, pois o hook depende delas.
- Seleções se sobrepõem; estes números não representam uma contagem única somada.
- Build frontend, typecheck frontend e backend de produção passaram. Nenhuma chamada paga ao provedor nesta etapa.
- Typecheck global de testes: 223 diagnósticos; permanece falhando. Não declarar aprovação global.

Pendentes: validação visual do novo build em execução, testes de rede do artefato, imagem Docker própria e restauração de backup. Recursos ainda em desenvolvimento não foram validados como disponíveis.


Data: 25/11/2026. Resultados reais desta etapa; agentes de teste simulados, PostgreSQL real.

## Validação posterior da aplicação integrada

- `http://127.0.0.1:3031/health`: 200; `/api/capabilities`: standalone/durableHistory true; `/api/copilotkit/info`: SSE, telemetryDisabled true, sem licenseStatus falsificado; HTML da interface: 200.
- PostgreSQL separado criado em 5544; migrations aplicadas ao banco independente.
- Agente criado pela API original: 201; exibido na lista original de Bots pelo navegador.
- Chave OpenAI do usuário salva no Vault criptografado; **uma conversa real** na UI pediu apenas `OK` e recebeu `OK`, usando `gpt-4.1-mini`. Reload mostrou a mesma pergunta e resposta. Não foi consultado faturamento e não se afirma custo exato. Saída limitada a 256 tokens por etapa.
- Suítes standalone store/runner/app/config na validação final: **14 pass, 0 fail, 76 assertions**. Teste HTTP de app usa endpoint AG-UI simulado, valida reinício/replay/contexto sem repetir execução. Inclui teste do limite de saída do modelo e de conexão vazia antes da primeira mensagem.
- Regressão config/copilot/thread-routes/thread-status: **291 pass, 0 fail, 679 assertions**.
- Build de frontend e typecheck de backend passaram. Typecheck da árvore inteira de testes falhou com numerosos diagnósticos fora dos arquivos standalone; não aprovado. Saída: `/tmp/openbot-standalone-test-types.log`.
- Reinício do processo independente depois do commit funcional e reload da conversa real: pergunta e resposta `OK` preservadas; nenhuma nova mensagem foi enviada ao provedor.

## Registro dos testes anteriores

| Verificação | Resultado |
| --- | --- |
| `bun install --frozen-lockfile` | Passou, 1384 installs verificados; lockfile sem alterações |
| Backend `bun run --filter server typecheck` | Passou |
| Frontend `bun run --filter app build` | Passou, Vite; aviso de chunks grandes |
| Migrations 0000–0092 em banco vazio exclusivo | Passou; `migrations-applied: ok` |
| Store local, sete testes | Passou, 33 assertions |
| Runner local, três testes | Passou; total store+runner: 10 testes / 51 assertions |
| Biome nos cinco arquivos novos de código/teste | Passou depois de organizar imports |
| Scripts de startup e provisionamento Composio | 58 pass, 0 fail, 224 assertions; incluindo opt-out padrão |

Cobertura dos testes de banco: snapshots e eventos de ferramentas em outro pool, formato JSONB real, claims concorrentes, cursores ordenados/paginação, negação de acesso entre usuários/agentes, expiração de lease e bloqueio de executor antigo, rejeição de runId repetido, renovação e validação de parâmetros.

Cobertura do runner: execução continua depois do unsubscribe, outro runner reconecta sem invocar agente novamente, cancelamento do run correto, recusa de stop/reconnect de outro usuário, concorrência e restauração de histórico numa nova execução. São agentes AG-UI simulados; nenhuma dessas verificações representa uma resposta real de um provedor de IA.

O primeiro teste de restauração falhou porque `AbstractAgent.runAgent` usa as propriedades do agente para preparar seu input. A implementação passou a restaurar `agent.messages` e `agent.state` antes da chamada; os dez testes passaram na repetição.

Testes que acessam Docker/portas locais precisaram executar fora do sandbox. A suíte dos scripts abre um proxy local para bloquear egress e passou após repetição com essa permissão.

## Ainda não validado

Boot standalone do servidor principal, cadastro/login/UI, criação de agentes pela UI, BYOK real, aprovações com ferramentas reais, rotina end-to-end, MCP real, computador/navegador, persistência após reinício de um processo real, imagens Docker próprias e bloqueio dos domínios proprietários na aplicação inteira.

A missão completa e o segundo marco continuam pendentes. O container servidor antigo não foi substituído; o servidor independente roda em processo próprio na porta 3031. O primeiro marco de conversa tem evidência real de UI, provedor e reload; os demais itens acima continuam como pendências, exceto os explicitamente validados na seção mais recente.
