# Confirmação de exclusão no caixa

A lixeira dos lançamentos em `app/(sistema)/projetos/[id]/page.tsx` executava
DELETE imediatamente. Agora abre uma confirmação local com descrição, valor em
BRL e efeito sobre o saldo calculado. Remover recebimento reduz o saldo; remover
pagamento aumenta o saldo, mas não estorna dinheiro ao profissional.

A confirmação reutiliza `DeleteConfirmation`, acompanha a área privada e não usa
toast para pedir autorização. Só um lançamento pode estar em confirmação por vez.
Cancelar/Escape devolve o foco à lixeira; durante o envio ambos ficam bloqueados.
A exclusão confirmada fecha o painel, recalcula os totais e foca o título do caixa.
Erro mantém registro e confirmação; resultado incerto continua exigindo recarga.
Navegação e logout removem a confirmação e invalidam retornos tardios.

Português/inglês acompanham o seletor; descrição cadastrada e moeda são preservadas.
Os filtros por ID e projeto, RLS e executor de gravações confirmadas permanecem.
Nenhuma migração SQL é necessária. Isto não implementa estorno nem histórico de
auditoria: a exclusão continua permanente após confirmação.

## Validação automatizada

`npm run test:deletions` cobre equipe, materiais e lançamentos com React/jsdom e
Supabase simulado. Para o caixa, verifica abrir sem gravar, cancelar/Escape/foco,
DELETE único com filtro da obra, sucesso, erro, timeout, navegação, logout,
respostas tardias, totais e tradução durante a confirmação.

## Testes manuais

1. Use uma obra de teste, com recebimento e pagamento conhecidos.
2. Abra a lixeira de um recebimento. Confira descrição, valor e aviso de redução
   do saldo. Nada deve ser enviado no Network até confirmar.
3. Cancele e repita usando Escape. O foco deve retornar à lixeira.
4. Abra um pagamento. Confira o aviso de aumento do saldo e de que a exclusão
   não estorna o pagamento. Troque para inglês com a confirmação aberta.
5. Confirme uma exclusão de teste. O registro e os totais só devem mudar após a
   resposta do servidor. O título do caixa recebe foco e permite seguir no teclado.
6. Com rede lenta, clique duas vezes em confirmar: deve existir apenas um DELETE.
   As demais lixeiras do caixa ficam bloqueadas enquanto a confirmação está aberta.
7. Teste erro de permissão e timeout: não pode surgir sucesso nem alteração otimista
   no saldo. Em resultado incerto, recarregue e confira antes de tentar novamente.
8. Abra a confirmação e navegue, ou saia por outra aba: ela deve desaparecer.
9. No celular, confira quebra de linha de descrições longas, botões e foco nos
   dois idiomas. A confirmação não é modal e não prende o foco.
