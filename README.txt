# Smart Offers | Painel Mensal

## Estrutura
- `index.html` — estrutura da página
- `css/style.css` — estilos e identidade visual
- `js/app.js` — edição, registros, gráficos e salvamento local
- `img/` — pasta reservada para imagens e ativos autorizados da marca

## Como abrir no VS Code
1. Extraia o ZIP para uma pasta.
2. Abra a pasta `smart_offers_vivo` no VS Code.
3. Instale a extensão **Live Server** (opcional, recomendado).
4. Clique com o botão direito em `index.html` e escolha **Open with Live Server**.
   Também pode abrir `index.html` diretamente no navegador.

## Como editar
- Clique nos valores dos cards para preencher os indicadores.
- Use “Nova campanha”, “Adicionar CHG”, “Adicionar teste” e “Nova entrega”.
- Edite os campos de destaques diretamente nas caixas de texto.
- Clique em “Salvar alterações” para gravar no armazenamento local do navegador.
- “Exportar dados JSON” cria uma cópia dos dados cadastrados.

## Observações
- Os dados ficam no `localStorage` do navegador e dispositivo usados.
- Os dados não são sincronizados com a equipe nem enviados para nuvem.
- Os gráficos usam Chart.js via CDN, então é necessária conexão com a internet para carregá-los.
- Não insira dados confidenciais da empresa ou de clientes em uma versão local sem autorização.
- A página usa cores inspiradas na Vivo; utilize logotipos oficiais somente com autorização.
