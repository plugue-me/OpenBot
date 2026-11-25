# Continuidade da implementação independente

Atualizado em 25/11/2026.

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
