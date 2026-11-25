# Relatório de testes standalone

Data: 25/11/2026. Resultados reais desta etapa; agentes de teste simulados, PostgreSQL real.

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

Não há evidência suficiente para declarar a missão concluída. O container servidor observado inicialmente continua pertencendo à execução anterior; não foi substituído por este código.
