# Relatório de testes standalone

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
