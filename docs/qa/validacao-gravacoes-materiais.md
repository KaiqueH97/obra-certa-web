# Validação das gravações de materiais

Edição de nome/quantidade e alteração de preço agora validam a projeção completa
retornada: ID positivo e seguro, nome e quantidade textuais, vínculo numérico com
a obra e preço numérico dentro do limite usado pela leitura, ou nulo.
A exclusão exige o ID selecionado. Ao salvar preço, o retorno também precisa
confirmar o valor enviado; null não confirma um preço numérico.

Resposta incompatível não anuncia sucesso nem dispara releitura dos totais. A
tela exige recarga porque a gravação pode ter ocorrido no banco. O formulário de
nome/quantidade continua aberto. O campo de preço mantém o comportamento anterior
de voltar ao último valor carregado ao encerrar o envio; ele não confirma o valor
real do banco quando há aviso de resultado incerto.

## Verificação manual

1. Em uma obra de teste, edite nome e quantidade de um material e confira a
   confirmação e a lista atualizada.
2. Altere o custo para 150,50, saia do campo e confira uma única gravação e os
   totais atualizados após confirmação. Repita com zero.
3. Exclua um material de teste pela confirmação e confira a atualização dos totais.
4. Em caso de resultado incerto, recarregue e confira o banco pela lista antes
   de repetir a ação. Não modifique dados reais para simular respostas inválidas.
5. Confira os fluxos nos dois idiomas. Os nomes cadastrados continuam preservados.

## Testes locais

As suítes `test:deletions` e `test:materials` cobrem respostas incompletas, outra
obra/material, preço divergente ou nulo, bloqueio de reenvio e ausência de sucesso
ou releitura indevida. O validador é compartilhado com a leitura da página.
As APIs são simuladas; os passos visuais acima continuam manuais.

Não há SQL. A criação de materiais pela calculadora, as gravações do caixa e a
geração de tipos do schema permanecem fora desta etapa. A validação não substitui RLS.
