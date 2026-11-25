# Preparação standalone

Ainda não há um comando que inicie a aplicação completa sem Intelligence. `INTELLIGENCE_MODE=standalone` ainda **não** está implementado; não configure URLs ou tokens fictícios para passar pela validação.

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

Compose de produção, imagens próprias e acesso web standalone ainda serão documentados depois da integração e validação reais.
