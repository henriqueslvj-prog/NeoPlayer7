# NeoPlayer v7

Versão de reprodução otimizada do NeoPlayer.

## Correção principal
A versão anterior fazia `arrayBuffer()` no proxy para filmes, episódios e segmentos. Isso obrigava a Vercel a baixar o conteúdo inteiro antes de entregá-lo ao navegador, causando falhas e lentidão.

A v7 transmite o corpo da resposta em streaming (`Readable.fromWeb(...).pipe(res)`), preservando `Range`, `Content-Range`, `Content-Length` e `Accept-Ranges` quando fornecidos pelo servidor de origem.

Também mantém a reescrita de manifests HLS e URLs de segmentos pelo proxy.

## Estrutura
- `api/xtream.js` — chamadas à API Xtream
- `api/proxy.js` — proxy de mídia/HLS com streaming
- `src/main.jsx` — interface e player


## Atualização V8 — perfis, séries e capas

- Perfis locais com playlists separadas por perfil.
- Organização de séries M3U por série → temporada → episódio com detecção ampliada de padrões.
- Limpeza de títulos, URLs e ruído de nomes na interface.
- Logo reconstruída no layout com marca transparente + texto, evitando fundos brancos.
- Busca automática de capas para filmes e séries sem artwork.
- Se `TMDB_API_KEY` estiver configurada, o NeoPlayer tenta o TMDB primeiro; sem a chave, usa TVMaze para séries e iTunes como fallback.
- Para Render Web Service: `npm install && npm run build` / `npm start`.

### Capas automáticas no Render

No serviço Render, em **Environment**, você pode adicionar `TMDB_API_KEY`. A chave não deve ser colocada no GitHub. O código continua funcionando sem ela usando os fallbacks.
