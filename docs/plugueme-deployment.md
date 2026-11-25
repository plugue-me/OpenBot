# Implantação Plugueme V1

## Desenvolvimento atual

`rtk proxy bun run start:standalone` inicia o servidor de fonte em 3031 e PostgreSQL exclusivo em 5544. `.env.standalone` privado mantém chave do Vault e credencial do banco. Não substituir pelo `.env` da referência.

Esse comando não representa implantação comercial final. Não entrega SSH, Docker, imagem ou código a clientes. O produto final é web, numa VPS gerenciada pela Plugueme.

## Distribuição de produção — pendente

Reaproveitar Dockerfiles/Compose MIT, construindo imagens próprias versionadas. Conter servidor/frontend, PostgreSQL, worker e supervisor/computadores quando integrados. Não incluir nativos, extensão, Recorder, Learning, brokers, testes, configuração de dev ou segredos no artefato final.

Exigir usuário não root quando aplicável, health checks, restart policies, redes internas, volumes, limites, logs, migrations como etapa controlada, banco sem exposição pública e HTTPS por proxy reverso. Não enviar imagens a registry externo sem autorização aplicável ao escopo.

Antes de atualizar: backup validado, identificação da imagem/commit, análise de migrations e verificação de saúde. Rollback de imagem não reverte automaticamente migrations destrutivas. Nenhuma implantação em VPS limpa foi validada ainda.

## Executor interno de integrações

O Compose de produção inicial está em `docker-compose.production.yml`, com servidor standalone, migrator, PostgreSQL e executor próprio. Configuração sem valores privados em `.env.production.example`. Não requer Composio, Arcade, Activepieces Cloud/Enterprise, Redis ou banco adicional. Ver `integrations/architecture.md` para contrato, autenticação, limites, medidas locais e ressalvas. A composição foi validada; o deploy completo com HTTPS/autenticação ainda exige teste em VPS. Na instalação local desta avaliação, o executor está em loopback 8093; REST de teste aponta para httpbin.org. Não inserir chaves de fornecedores reais nesse endpoint de teste.
