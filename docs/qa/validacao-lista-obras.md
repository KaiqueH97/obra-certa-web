# Validação das respostas da lista de obras

A paginação já conferia IDs, duplicatas e quantidade de registros. Agora também
confere que o título é texto, o proprietário é uma string não vazia e a data de
criação é uma string que pode ser interpretada como data. Uma página com algum
registro inválido exibe o erro recuperável existente, sem renderizar uma lista
parcial nem liberar as ações da página.

Os nomes cadastrados não são traduzidos ou modificados. A verificação do
proprietário é de formato básico, não de autorização: RLS continua responsável
pelo isolamento. Esta etapa cobre a leitura da lista; não substitui os tipos
gerados do schema nem a validação das respostas de gravação.

## Verificação manual

1. Abra Projetos em português e inglês. Confira nomes, datas e paginação.
2. Simule uma falha de rede ao mudar de página. Confira o aviso e “Tentar
   novamente”; ao recuperar a conexão, a página solicitada deve ser carregada.
3. Confira que criar, editar e excluir obras continuam funcionando em uma obra
   de teste. Não é necessário modificar dados reais para simular respostas ruins.

## Testes automatizados

`npm run test:projects` simula campos ausentes, nulos e com tipos incorretos,
aceitação de timestamp com fuso e microssegundos, preservação de nomes e
recuperação da tela após resposta inválida. Também mantém os testes existentes
de paginação, cancelamento e foco.

Não há SQL nem alteração do banco nesta etapa.
