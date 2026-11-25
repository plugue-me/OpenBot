# Preparação standalone

## Inicialização disponível

```sh
rtk proxy bun run start:standalone
```

Abra `http://127.0.0.1:3031`. O comando gera `.env.standalone` privado uma única vez, inicia PostgreSQL separado em 5544, aplica migrations, compila o frontend se ainda não existir e executa `server/src/standalone-entry.ts`. Não carrega `.env` da referência nem solicita licença/login Intelligence. Requer Docker Desktop, Bun e dependências instaladas. Para recompilar a interface após alterações: `rtk proxy bun run --filter app build`.

O servidor e as credenciais usam o banco `openbot_independent`, no volume exclusivo do projeto Compose `openbot-independent`. Não apagar `.env.standalone`: sua chave criptográfica protege o Vault. A instalação de referência em 5432 e seus containers não são alterados.

Cadastre uma chave de modelo no Vault original (OpenAI por padrão). Nesta máquina a chave fornecida para a validação já foi salva ali; não é necessário reintroduzi-la. Nunca coloque chaves em comandos ou commits. O modelo local padrão é `gpt-4.1-mini`, com saída limitada a 256 tokens por etapa; ajuste `.env.standalone` e reinicie somente o standalone se necessário.

Para parar, Ctrl+C no terminal do servidor. O PostgreSQL e seu volume permanecem. Para parar apenas esse banco: `rtk proxy docker compose --env-file .env.standalone -f docker-compose.standalone.yml stop postgres`. Não usar `down -v`.

O primeiro marco cobre agentes, Vault, conversa SSE e histórico; os demais recursos mostram indisponibilidade. Não é a distribuição final para VPS. A imagem Docker própria ainda precisa ser construída e validada. O modo é selecionado pelo comando/entrypoint específico, não por URLs ou tokens fictícios nem por `INTELLIGENCE_MODE` no entrypoint original.

## Estado reproduzível de desenvolvimento

Use esta branch `plugueme/standalone`, baseada em `6d1919a3`. Não atualize para a main que remove o backend. Projeto declara Bun 1.4.3; os testes desta etapa rodaram com o Bun 1.4.2 instalado no Mac.

```sh
rtk proxy bun install --frozen-lockfile
rtk proxy bun run --filter server typecheck
rtk proxy bun run --filter app build
```

Para testes de banco, crie um banco **exclusivo de testes** no PostgreSQL do OpenBot. Não use o banco `openbot`; a suíte o recusa. Os exemplos abaixo usam somente a credencial pública de desenvolvimento, não uma credencial de produção:

```sh
rtk proxy docker exec openbot-postgres-1 createdb -U openbot openbot_standalone_test
rtk proxy env DATABASE_URL=postgres://openbot:openbot@127.0.0.1:5432/openbot_standalone_test bun server/scripts/migrate.ts
rtk proxy env TEST_DATABASE_URL=postgres://openbot:openbot@127.0.0.1:5432/openbot_standalone_test bun test server/tests/standalone-store.integration.test.ts server/tests/standalone-runner.integration.test.ts
rtk proxy bun test scripts/start-restart-guard.test.ts scripts/setup-composio.test.ts
```

O banco `openbot_standalone_test` já foi criado neste Mac; não repita `createdb` se ele existir. Nenhuma migration foi aplicada ao banco da aplicação nesta etapa. A suíte limpa somente as threads criadas pelos próprios testes.

## Integrações

`scripts/start.sh` agora deixa provisionamento Composio desligado por padrão. Uma chave Composio/Arcade fornecida continua sendo lida normalmente. `OPENBOT_PROVISION_COMPOSIO=on` opta explicitamente pelo provisionamento externo antigo. Para esta missão deixe off e não execute `setup:composio`.

Não copiar `.env` do checkout mais recente. Ao preparar a instalação final, partir deste `.env.example`, substituir seus endpoints Intelligence por uma configuração de modo implementada e gerar os segredos próprios da instalação. Os defaults de desenvolvimento não são a configuração final de VPS.

Compose de produção e imagens próprias ainda serão documentados depois de construídos e validados.
