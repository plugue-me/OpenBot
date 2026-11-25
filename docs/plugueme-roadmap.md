# Roadmap Plugueme V1

O escopo canônico é `PLUGUEME-V1-SCOPE.md`; substitui as missões anteriores. A execução preserva módulos MIT existentes e o ambiente de referência.

| Etapa | Aceitação | Estado |
| --- | --- | --- |
| 1. Produto web | Capacidades centrais; voz/Recorder/Learning/brokers/nativos fora da experiência; sem ações pendentes clicáveis; chat preservado | Em implementação. API, navegação, composer e telas usam capacidades. Exclusão física de todos os chunks/dependências legados ainda requer validação. |
| 2. Execução e memória | Mesmo runner/leases para chat e headless; memória individual e corporativa autorizadas | Chat e headless usam o mesmo runner PostgreSQL; memória pessoal conectada. Aprovações MCP integradas; memória corporativa pendente. |
| 3. Equipe | Grupos, autoria, delegação Gerente→Analista, resultado e limites, sem navegador aberto | Reaproveitar group/handoff/delivery; pendente. |
| 4. Autonomia | Tasks/CRON/fusos/goals/check-ins, worker sem browser, falha/cancelamento/reinício/dedupe | Cron/fusos, execução headless e tarefa de item existente integrados e testados. Criação manual de tarefa implementada/testada. Ferramentas MCP aprovadas conectadas; goals/check-ins pendentes. |
| 5. Ferramentas | MCP/OAuth, grants, aprovação uma vez, arquivos, browser/terminal isolados | Plugins, grants, Vault e aprovação/retomada MCP integrados e testados. OAuth real, arquivos e computador/supervisor pendentes. |
| 6. Produto | Templates versionados de oito funcionários e onboarding, sem prometer integrações inexistentes | Pendente; marca/tokens existentes serão reaproveitados. |
| 7. Administração | Login, usuários, BYOK, modelos por agente, medição real e limites | Vault e guards reutilizados; autenticação comercial e consumo exigem validação. |
| 8. Operação | Compose/imagens próprias, HTTPS, recursos, backup e restauração real em instalação limpa | Compose local isolado existe; produção/backup pendentes. |

Em cada etapa: fonte/histórico/testes/licença → critérios → adaptação → testes → documentação → commit. Sem chamadas pagas de IA nesta adequação web. A autorização anterior de push permanece registrada, sujeita às restrições do escopo atual para publicação de código/imagens.
