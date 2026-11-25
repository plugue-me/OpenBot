# Inventário Activepieces / Plugueme

Revisão em 25/11/2026. Fonte pública fixada: [98c6c8e9](https://github.com/activepieces/activepieces/tree/98c6c8e9750a6c38bff94913b1a3ee192e4f2065). A [licença da raiz](https://github.com/activepieces/activepieces/blob/98c6c8e9750a6c38bff94913b1a3ee192e4f2065/LICENSE) disponibiliza o conteúdo fora de `packages/ee/` e `packages/server/api/src/app/ee` sob MIT, ressalvadas licenças dos componentes de terceiros. Nenhum módulo Enterprise é importado. O copyright/licença foi preservado em `services/integration-executor/ACTIVEPIECES-LICENSE`; os avisos incorporados nos bundles npm são mantidos.

Os pacotes npm são bundles sem dependências declaradas e sem campo `license`; a procedência MIT é o caminho Community no commit acima, e não uma suposição sobre esse campo ausente. Versões e integridades de download estão fixadas no package-lock. A instalação desabilita scripts. Não há download ou instalação dinâmica de conectores em execução. Uma busca dos avisos incorporados não encontrou GPL/AGPL/SSPL/BSL; isso não substitui uma SBOM transitiva completa antes da distribuição comercial final.

| Integração | Pacote fixado | Ações no pacote | Ações habilitadas | Autenticação nesta etapa |
| --- | --- | --- | --- | --- |
| gmail | 0.19.0 | 37 | 6 | OAuth Google próprio + refresh no Vault |
| google-calendar | 0.14.0 | 25 | 5 | OAuth Google próprio + refresh no Vault |
| google-drive | 0.14.1 | 53 | 5 | OAuth Google próprio + refresh no Vault |
| google-sheets | 0.21.0 | 61 | 4 | OAuth Google próprio + refresh no Vault |
| google-ads | 0.0.3 | 8 | 2 | OAuth Google próprio + refresh no Vault |
| facebook-pages | 0.4.3 | 19 | 4 | Token/API key pessoal; renovação manual |
| instagram-business | 1.1.2 | 27 | 5 | Token/API key pessoal; renovação manual |
| whatsapp | 1.0.1 | 23 | 4 | Token System User + Business Account ID (JSON) |
| hubspot | 0.14.0 | 54 | 3 | Token/API key pessoal; renovação manual |
| Meta Ads | Conector próprio | 2 | 2 leituras | Token Meta pessoal; renovação manual |
| REST personalizada | Conector próprio | 5 | GET/POST/PUT/PATCH/DELETE | Bearer ou cabeçalho de chave configurado pelo administrador |

O JSON ao lado contém os nomes e propriedades de **todas** as ações encontradas nos pacotes instalados, além da seleção habilitada. Isso distingue existência, oferta e validação real. O executor anuncia 38 ações dos pacotes, duas Meta Ads próprias e cinco REST. Apenas REST teve validação remota real nesta etapa. Os conectores dos fornecedores tiveram descoberta/contratos validados, sem acesso a contas reais.

## Lacunas e restrições

- **Gmail:** leitura de perfil/mensagens/busca/labels, criar label e arquivar; envio de e-mail, anexos e aprovação por e-mail do Activepieces não são anunciados nesta etapa. A aprovação é a nativa do Plugueme.
- **Calendar:** listar calendários/eventos, obter/criar/excluir evento. IDs das opções dinâmicas são informados diretamente; não se oferece o formulário do Activepieces.
- **Drive:** obter/listar arquivos, obter perfil do Drive, criar pasta e lixeira. `download_files=true` é recusado, pois ainda não há serviço de arquivos no executor. O conector Drive anterior continua separado.
- **Sheets:** obter planilha/valores, atualizar/anexar valores. Entrada JSON preservada; sem execução do motor de workflow.
- **Google Ads:** somente searchRecords/retrieveReport. Não habilitamos alterações de orçamento ou Customer Match. Acesso real depende do projeto/API/conta e dos requisitos vigentes do Google; não foi validado com anunciante real.
- **Meta Ads:** não foi localizado um pacote dedicado na árvore Community revisada. Facebook Leads existe, mas não equivale a Ads. A implementação própria lê campanhas e insights de sete dias via Graph v23.0; sem alteração de gastos, paginação completa ou validação de conta real.
- **Facebook Pages:** listar páginas, detalhes e posts, criar post. **Instagram Business:** perfil/mídia e comentários/respostas. Requerem os tokens, permissões e ativos adequados da Meta; a presença da ação não concede acesso a esses ativos.
- **WhatsApp:** perfil, números, mensagem e template. Exige conta Business/telefone/template autorizado e pode ter cobrança da Meta. Não há renovação automática de System User token nem webhook instalado nesta etapa.
- **HubSpot:** obter contato/empresa/listar owners com token privado. OAuth HubSpot e criação com propriedades dinâmicas ainda não são oferecidos; existem no código upstream, mas não foram adaptados para este executor.
- Ações de triggers, waits, arquivos, AI provida pelo Activepieces, store de workflow e propriedades dinâmicas não implementadas ficam fora da allowlist. Um contexto de runtime não implementado falha explicitamente.
- OAuth Google requer cliente próprio por integração e consentimento/escopos aprovados. Nunca usamos clientes/chaves do Activepieces Cloud. Refresh e rotação usam os locks e Vault existentes do Plugueme. OAuth de fornecedores reais ainda precisa de validação com conta de teste.

APIs dos fornecedores têm termos, limites, verificações e custos próprios, independentes da licença MIT do conector.
