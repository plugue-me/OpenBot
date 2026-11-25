# Segurança Plugueme V1

Estado: desenvolvimento local; não aprovado para exposição a clientes.

- Preservar guards originais de identidade, origem/CORS, roles, Vault, endpoints, grants e aprovações. Capacidades de produto não concedem autorização.
- Standalone mantém o modo local de usuário único restrito pelos guards originais. Produção exige autenticação configurada e validação de sessões/roles. Nunca expor single-user publicamente.
- Segredos ficam no Vault criptografado ou configuração privada ignorada pelo Git; não inserir chaves em logs, documentação, imagens ou prompts. O orçamento de IA anterior não autoriza novos testes pagos indiscriminados.
- Memória individual continua pessoal. Conhecimento corporativo exige autorização explícita, retenção e prevenção de vazamentos entre agentes/usuários.
- MCP/redirects devem manter prevenção de SSRF/metadata/private hosts; concessão de ferramenta não pode ampliar acesso por delegação.
- Operações externas ambíguas não são repetidas automaticamente. Aprovação deve vincular ator, ação e parâmetros, com resultado auditado.
- Computadores exigem workspace persistente autorizado, limites e egress. Nenhum Docker socket para agente/frontend, host arbitrário ou privileged sem justificativa.
- Build web não publica source maps; distribuição final deve excluir testes, fontes desnecessárias, configuração de dev, segredos e aplicativos nativos. Auditoria transitiva de licenças/imagens permanece pendente.
- Telemetria proprietária é desabilitada no entrypoint local; verificação de egress da distribuição inteira ainda é necessária.

Pendências: auth comercial, teste multiusuário end-to-end, ACL corporativa, hardening de imagens, carga/retention, revisão de dependências e teste de rede isolado. Ver provenance e test-report para evidências, sem inferir segurança por existência de código.
