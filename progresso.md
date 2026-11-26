# Progresso do Plugueme

Atualizado em **26/11/2026** (America/Sao_Paulo).
Branch: `codex/plugueme-intelligence`.

## Onde o trabalho parou

A última implementação está no commit `ffba3afb` (`feat(integrations): run Community connectors`), enviado ao GitHub. A instalação local foi atualizada e a integração REST foi validada. **A V1 ainda não está concluída nem validada para produção.** Este registro e a regra pendente do `.gitignore` são incluídos no próximo commit de checkpoint.

## Concluído e verificado

- Runtime standalone sem dependência obrigatória do Intelligence, Composio ou Arcade: histórico PostgreSQL, streaming, replay e execução durável.
- Memória pessoal, tarefas manuais e rotinas/CRON conectados ao runner local.
- MCP personalizado preservado, com grants, políticas e aprovações humanas. Aprovar uma vez, negar, revogar ferramenta e pausar antes da execução foram testados.
- Camada abstrata `IntegrationBackend`, com executor privado em Docker para pacotes Community MIT do Activepieces; sem servidor/UI completa ou módulos Enterprise.
- Catálogo inicial: Gmail, Calendar, Drive, Sheets, Google Ads, Facebook Pages, Instagram Business, WhatsApp Business e HubSpot; Meta Ads e REST têm implementação própria inicial.
- Seleção de 38 ações dos nove pacotes, duas leituras Meta Ads e cinco operações REST. Descoberta validada; isso não significa que todas as contas dos fornecedores foram testadas.
- API Keys pessoais no Vault, permissões por agente e auditoria reutilizadas do OpenBot. OAuth Google usa cliente próprio e renovação do fluxo existente.
- REST real validado com token fictício em `httpbin.org`: criptografia, bloqueio sem grant, autenticação remota, ocultação da chave, revogação e auditoria. Nenhuma chamada paga de IA nesses testes.
- Skin corrigida com persistência das preferências. Rótulos visíveis alterados para Agente/Agentes.
- Cadastro local conferido após uma resposta incorreta do modelo: não existiam os agentes `dev`/`qa` citados na conversa; nenhum agente foi removido. Instruções reforçadas para exigir evidência de ferramenta antes de afirmar mudanças no cadastro.

## Validação mais recente

- Backend e frontend: typecheck de produção aprovado; build web aprovado.
- Executor: 2 testes, 37 assertions.
- MCP personalizado, credenciais pessoais e standalone: 21 testes, 109 assertions.
- Interface, skin, navegação, roster, aprovações e instruções: 62 testes, 297 assertions.
- Conexões/provedores na interface: 11 testes, 13 assertions.
- Imagem Docker do executor construída e executada; chamada REST real também passou pelo container.
- Compose de produção validado estruturalmente; o stack completo não foi implantado numa VPS.
- O typecheck global de testes tinha 223 diagnósticos preexistentes no marco anterior; não foi declarado aprovado.

As seleções de testes podem se sobrepor; os números não devem ser somados como uma suíte única.

## Ambiente local no último checkpoint

- Aplicação: `http://127.0.0.1:3031`.
- Banco próprio: Compose `openbot-independent`, PostgreSQL em loopback `5544`.
- Executor próprio: container `plugueme-integrations-local`, loopback `8093`, sem UI pública.
- REST do executor local aponta para **httpbin.org, apenas para teste**. Não inserir chaves reais de fornecedores nesse endpoint.
- Configurações privadas permanecem ignoradas pelo Git. Não versionar `.env.standalone`, chaves, tokens, bancos ou `.copilotkit/local.json`.
- Instalação e containers proprietários de avaliação permanecem separados; nenhum código proprietário foi extraído ou reutilizado.

## Próximos passos

1. Validar contas de teste reais e scopes por fornecedor, começando por Google. Não confundir descoberta de ações com funcionamento comprovado na conta.
2. Completar autenticação e renovação onde necessário: Meta/WhatsApp usam tokens com renovação manual nesta etapa; HubSpot usa token privado, sem OAuth adaptado.
3. Evoluir configuração REST pela interface, múltiplas APIs/contas e ações adicionais conforme necessidade real. Não há paridade completa com Composio/Arcade.
4. Integrar grupos, autoria e delegação entre agentes; depois goals/check-ins e memória corporativa com ACL.
5. Integrar arquivos e computador/browser/terminal isolados com imagens próprias.
6. Concluir autenticação multiusuário, modelos por agente, consumo e limites financeiros.
7. Validar stack completo em VPS, HTTPS, backup/restauração limpa, carga e inventário transitivo de licenças antes da distribuição comercial final.

## Documentos para retomar

- [Escopo da V1](docs/PLUGUEME-V1-SCOPE.md)
- [Matriz de funcionalidades](docs/plugueme-feature-matrix.md)
- [Roadmap](docs/plugueme-roadmap.md)
- [Arquitetura das integrações e infraestrutura](docs/integrations/architecture.md)
- [Conectores, ações e limitações](docs/integrations/activepieces-connector-matrix.md)
- [Procedência e licenças](docs/implementation-provenance.md)
- [Relatório de testes](docs/standalone-test-report.md)

Ao retomar, conferir `git status`, este arquivo e a matriz antes de alterar o código. Preservar implementações MIT maduras, usar bancos de teste separados e evitar chamadas pagas desnecessárias.
