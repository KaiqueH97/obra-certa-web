# Pendências confirmadas — revisão de 20/10/2026

Revisão direcionada do código atual, após paginação de obras e equipe. Não é
uma nova certificação de segurança nem uma revisão das configurações remotas.

| Prioridade | Evidência | Próxima correção |
| --- | --- | --- |
| Média | `app/(sistema)/projetos/[id]/page.tsx`: busca todas as tarefas, materiais, transações e funcionários antes de liberar a tela. | Paginar abas e usar agregações no banco para totais. Não calcular o saldo apenas sobre a página visível. |
| Média | `app/(sistema)/calcular/page.tsx`: `loadAllRows` no seletor de obras. O seletor de profissionais dos detalhes também carrega todos os registros. | Seletores com busca e limite no servidor, mantendo o registro escolhido e cancelando respostas antigas. |
| Média | `app/(sistema)/home/page.tsx`: botão “Gerar Relatório” sem ação e status fixo “Em andamento”. `app/(sistema)/projetos/page.tsx`: progresso fixo em 0%. | Implementar relatório e indicadores derivados de dados reais, ou retirar os elementos até terem comportamento funcional. |
| Média | Tradução e formatação ainda espalhadas pelas telas; `pt-BR` e mensagens em português fixos. | Completar a [migração de idiomas](./idiomas.md) em etapas, incluindo validações e leitores de tela; manter BRL. |
| Média | Detalhes de obra: campos de material/preço e botões de edição precisam de nomes acessíveis explícitos; há estilos de texto claro que exigem verificação visual. | Revisar associação de labels, nomes de botões, foco e contraste medido em estados normal/desabilitado, nas duas línguas. |
| Baixa | Tipos escritos manualmente divergem do schema em campos opcionais, por exemplo `preco_total`/`concluida` nos detalhes. | Gerar tipos do schema real e validar os dados de entrada nas fronteiras, sem tratar resposta inválida como sucesso. |

RLS, autenticação e gravações têm correções e testes anteriores. Esta revisão não
confirma novas brechas nessas camadas; futuras alterações devem preservar as
políticas e as verificações já implementadas. Os testes locais simulam as APIs;
os roteiros manuais continuam necessários no ambiente conectado ao Supabase.
