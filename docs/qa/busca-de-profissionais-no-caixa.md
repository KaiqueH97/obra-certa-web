# Busca de profissionais no caixa

Não há SQL para aplicar nesta etapa. Execute com uma conta de teste no Supabase.

1. Abra uma obra: a equipe não deve ser consultada antes de escolher “Saída: Pagamento da Equipe”.
2. Com mais de 20 profissionais, navegue pelas páginas; confira no Network intervalos de 20 registros.
3. Busque pelo nome usando Buscar e Enter. Enter deve apenas pesquisar, sem lançar pagamento.
4. Escolha um profissional: a diária preenche o valor. Edite o valor e busque outro nome sem selecionar outro profissional: seleção e valor editado devem permanecer.
5. Troque para inglês: rótulos traduzidos, nomes originais e moeda BRL; valor e seleção preservados.
6. Simule falha de rede ao buscar, depois tente novamente. Não deve aparecer uma lista antiga como resultado da nova consulta.
7. Lance um pagamento de teste: confira valor, nome e vínculo ao profissional. Durante envio, controles ficam bloqueados; após sucesso, formulário limpa.
8. Sem profissional selecionado, pagamento deve ser impedido. Trocar para recebimento deve limpar a seleção.
9. Confira no celular e por teclado: foco visível, labels e navegação da lista.

Automação local: `npm run test:worker-picker` e `npm run test:deletions`.
Testes usam respostas simuladas; não substituem a validação conectada acima.
