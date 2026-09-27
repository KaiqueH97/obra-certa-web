# Solicitação do link de recuperação

## Correção

`/recuperar` não tratava exceções da chamada ao Auth, podendo deixar o formulário
preso em envio. Também mantinha um `Toaster` duplicado e anunciava e-mail enviado
sem confirmar entrega ou existência da conta.

`lib/password-recovery.ts` agora controla o ciclo da solicitação por instância da
página, com trava síncrona e limite de espera local de 20 segundos. A interface
usa mensagens na própria tela, rótulo associado ao e-mail, autocomplete, campos
bloqueados durante envio e foco nos avisos finais.

| Resultado | Comportamento |
| --- | --- |
| Auth retorna objeto de dados e `error: null` | Aviso neutro para conferir caixa de entrada e spam |
| Rejeição explícita HTTP 4xx | Erro compreensível, preserva e-mail e permite tentativa manual |
| HTTP 429 | Orienta aguardar antes de tentar novamente |
| Exceção, 5xx, erro sem status, retorno incompleto ou timeout | Resultado incerto; orienta conferir o e-mail antes de outra solicitação |

Não há reenvio automático. Após aceitação ou resultado incerto, a mesma instância
não envia outro pedido; o link de retorno ao login continua disponível. Isso não
é um limite de requisições entre abas ou dispositivos: essa proteção pertence ao
Supabase. Reabrir a página permite outra solicitação manual, após conferir o
resultado anterior.

Desmontar invalida o retorno pendente e encerra a espera local. Timeout e saída da
página não cancelam o envio no servidor nem os efeitos internos do SDK. Respostas
tardias não trocam o aviso nem deixam notificações globais na interface.

O link **Voltar para o Login** agora aponta para `/login`. O destino enviado ao
Auth continua sendo a origem atual com `/redefinir-senha`, sem aceitar destinos
de query strings. O contrato foi conferido na implementação instalada de
`resetPasswordForEmail` e na [documentação oficial](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

## Escopo

Esta etapa trata somente de **solicitar o link**. A confirmação da sessão de
recuperação e a gravação da nova senha em `/redefinir-senha` precisam de uma etapa
própria. Configurações de SMTP, Site URL, templates e Redirect URLs não foram
alteradas. A URL de redefinição deve estar permitida no projeto Supabase usado
pelo aplicativo, como já era necessário antes desta mudança.

Nenhum SQL, migration, pacote ou variável de ambiente é necessário.

## Validação automatizada

Execute `node --test tests/password-recovery.test.mjs`.

São 17 testes: 13 do controlador e quatro da página React com jsdom. Cobrem
normalização do e-mail, entradas vazias, duplicatas, contrato incompleto, rede,
rejeições, limite de tentativas, timeout, desmontagem, foco, links e destino fixo.
As respostas do Auth são simuladas; nenhum e-mail real é enviado pelos testes.

Em 26/09/2026, passaram os 17 testes novos, os 77 testes de regressão de cadastro,
login/logout e proxy, o lint dos arquivos alterados, `npx tsc --noEmit` e `npm run build`.

## Conferência manual pendente

1. Abra `/recuperar` sem sessão. Confira o campo rotulado e o link `/login`.
2. Use um e-mail de teste sob seu controle e conexão lenta. Envie duas vezes
   rapidamente: deve haver apenas uma chamada a `/auth/v1/recover`, com campo e
   botão bloqueados enquanto ela está pendente.
3. Após a resposta aceita, confira o aviso neutro, o foco no aviso e a ausência de
   notificações duplicadas. Verifique a caixa de entrada e o spam. A entrega real
   depende da configuração de e-mail do ambiente.
4. Bloqueie `/auth/v1/recover` pelo DevTools e envie. Deve aparecer resultado incerto
   sem carregamento infinito, após no máximo 20 segundos de espera local.
   Desbloqueie e confira sua caixa de entrada antes de reabrir a página e solicitar
   outro link. Um envio anterior pode ter chegado ao servidor.
5. Saia da página durante uma requisição lenta. O retorno posterior não deve
   apresentar notificações nem alterar a página para a qual você navegou.
6. Se o servidor rejeitar explicitamente a solicitação, o campo deve manter o
   e-mail informado e permitir correção. Não deve mostrar mensagens internas do Auth.
