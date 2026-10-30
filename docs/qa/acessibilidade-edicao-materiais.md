# Edição de materiais — acessibilidade

Não há SQL para aplicar.

1. Use Tab para chegar a Editar em um material; o contorno de foco deve ser visível.
   Ative com Enter. O foco deve chegar ao nome e os labels Nome e Quantidade
   devem permanecer visíveis após digitar.
2. Edite os campos e pressione Escape: fecha sem salvar e devolve foco ao botão
   Editar do mesmo material. Repita com Cancelar edição.
3. Pressione Enter dentro do formulário para salvar. Durante o envio, Escape e
   Cancelar não devem fechar a edição, e cliques repetidos não duplicam UPDATE.
   Após confirmação e releitura, foco deve chegar ao título Lista de Materiais.
4. Troque português/inglês durante edição: foco e rascunho permanecem; labels e
   botões traduzem sem alterar os dados cadastrados nem disparar gravação.
5. Clique no rótulo Custo Registrado e confira que ele foca o preço correspondente.
   Verifique também anúncio do nome do material com leitor de tela.
6. Na lista de obras, os ícones devem anunciar “Editar [nome]” e “Excluir [nome]”.
   Os botões têm área mínima de 44 px; confira toque e quebra de linha no mobile
   e na largura intermediária do desktop, inclusive com zoom de 200%.
7. Confira erro de rede, gravação incerta, troca de obra e logout. Nenhuma resposta
   tardia deve reabrir formulário ou roubar foco de outra tela.
8. Faça a verificação com leitor de tela e sob luz externa nas duas línguas.

Automação: npm run test:deletions e npm run test:projects.
Testes jsdom verificam foco, associação de labels, cancelamento e submit; não
simulam a renderização visual, o acionamento físico de Enter pelo navegador nem
a experiência completa de leitor de tela. Lint e build complementam a validação.

Cores mais escuras foram aplicadas às ações e ao botão Salvar material.
A medição de contraste de todos os estados e a revisão global das telas seguem
pendentes; esta alteração não é uma certificação WCAG.
