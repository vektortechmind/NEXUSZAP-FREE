# Hospedagem compartilhada (sem Node no servidor)

O servidor **não precisa** de Node.js, npm ou `npm run build`. Ele só serve arquivos estáticos (HTML, CSS, JS).

## O que fazer

1. **Num computador com Node.js** (pode ser o seu PC, uma vez só):
   - `cd landing`
   - `npm install`
   - `npm run build`

2. Envie **todo o conteúdo** da pasta `landing/dist/` para o servidor:
   - FTP/SFTP/cPanel “Gerenciador de arquivos” → normalmente `public_html/` ou uma subpasta, por exemplo `public_html/landing/`.

3. Pronto. O site é só esses arquivos; **nada roda no servidor** além do Apache/Nginx entregando estáticos.

## Por que ainda existe `npm run build`?

O código React/Tailwind precisa ser **compilado** (minificar, agrupar CSS/JS). Isso roda **na sua máquina** (ou em CI como GitHub Actions), não na hospedagem.

Se quiser **zero comandos**, peça para alguém gerar o `dist/` e use só o ZIP dessa pasta no upload.

## Subpasta (ex.: `seudominio.com.br/nexuszap/`)

O projeto está com `base: "./"` no Vite: os links de CSS/JS são **relativos** e tendem a funcionar dentro de uma subpasta.

Se a página abrir em branco, confira no painel se o domínio aponta para a pasta certa e se todos os arquivos de `dist/` (incluindo a pasta `assets/`) foram enviados.

## Apache (.htaccess)

O build copia `public/.htaccess` para a raiz do `dist/`. Ajuda se alguém acessar uma URL direta e o servidor precisar cair no `index.html`.

Em **subpasta**, pode ser necessário ajustar `RewriteBase` no `.htaccess` (ex.: `RewriteBase /landing/`).

## Nginx

Não use `.htaccess`. Configure `try_files $uri $uri/ /index.html;` no `location` da pasta do site.
