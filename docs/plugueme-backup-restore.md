# Backup e restauração — planejamento de validação

Estado: **pendente**, nenhum backup/restauração foi apresentado como validado.

Reutilizar ferramentas PostgreSQL para banco e inventariar volumes de arquivos/workspaces antes da implementação. A fonte da verdade inclui threads/runs/eventos, usuários, agentes, rotinas, grants, aprovações e credenciais criptografadas.

O backup deverá contemplar PostgreSQL, arquivos/workspaces autorizados e configurações. A chave de criptografia do Vault precisa de cópia segura **separada**, com acesso restrito. Um dump sem essa chave não permite recuperar credenciais; um dump com chave em arquivo desprotegido não é aceitável.

Teste de aceitação: criar ambiente limpo separado, restaurar banco/arquivos/configuração, aplicar somente migrations compatíveis, validar login/autorizações, abrir histórico e verificar leitura autorizada do Vault sem exibir chaves. Registrar versões, resultado e falhas. Nunca restaurar por cima dos dados da referência ou de outro projeto para testar.
