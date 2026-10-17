# Bancada — prévia de manutenção

Execute `node server.cjs` e acesse http://127.0.0.1:4173.

Login de teste: admin / admin.

Protótipo em JavaScript moderno, HTML e CSS responsivo, sem instalação de dependências. Inclui dashboard, filtros por status, cadastro de lotes e TVs, edição de serviços, datas de entrada e saída e criação de usuários por administrador. Dados iniciais ilustrativos.

Os dados e as credenciais de demonstração são persistidos em localStorage apenas no navegador atual. A sessão usa sessionStorage. Não há banco compartilhado, autenticação de servidor nem segurança de produção. Use apenas dados e senhas fictícios. Próxima etapa para uso real: API, banco relacional, senhas com hash e sessões seguras no servidor.

Os cards contam TVs. Os filtros exibem lotes contendo TVs no status escolhido. Um lote é concluído quando todas as TVs estão concluídas, fica em andamento se houver TV em andamento e, nos demais casos, fica em espera.

## Controladoria
Modelos configuráveis com cabeçalho, logotipo PNG/JPG e condições. Cadastro de empresa solicitante, CNPJ, representante e contato. PDFs gerados no navegador com pdf-lib, guardados em IndexedDB; o histórico e os modelos usam localStorage. Ordens de serviço e rascunhos sem validade fiscal. Não há integração com emissor fiscal.

Os dados da prestadora são configurados uma única vez pelo administrador em Controladoria > Configurar prestadora e aplicados a todas as novas OS e notas. Incluem logotipo, nome, CNPJ, endereço e contatos. Os PDFs usam layout A4 com cabeçalho, bloco da solicitante, tabela de equipamentos, serviços e total. Cada documento guarda os dados da prestadora utilizados na emissão; os PDFs históricos são preservados.

Catálogo de serviços: cadastro com nome, descrição e preço padrão. Na emissão, é possível combinar vários serviços do catálogo e avulsos, ajustar quantidades e salvar avulsos no catálogo. O total usa centavos inteiros e os documentos guardam os itens e preços usados na emissão, sem depender de alterações futuras no catálogo. Os PDFs detalham quantidade, valor unitário e subtotal.
