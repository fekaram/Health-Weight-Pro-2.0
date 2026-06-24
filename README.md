# Health Weight Pro 1.1

Aplicativo web estatico/PWA para acompanhamento pessoal de emagrecimento, nutricao, Nutri IA, treinos, fotos de evolucao e uso de tirzepatida.

## Recursos

- Dashboard com peso atual, progresso da meta, IMC, taxa semanal, data estimada, cintura e score de aderencia.
- Diario de habitos com agua, proteina, calorias, musculacao, cardio, sono, passos e aplicacao.
- Diario alimentar por refeicao, foto opcional, resumo de macros e plano nutricional.
- Nutri IA para analisar refeicoes por texto ou foto usando a API da OpenAI.
- Biblioteca de refeicoes favoritas.
- Registro de treinos.
- Controle de tirzepatida com dose, peso, efeitos colaterais e escala de intensidade.
- Fotos de evolucao por frente, lado e costas.
- Graficos com Chart.js quando disponivel e desenho offline alternativo.
- Exportacao CSV, Excel, PDF e backup/importacao JSON.
- PWA com manifest e service worker para uso offline.

## Estrutura

- `index.html`
- `manifest.json`
- `sw.js`
- `css/styles.css`
- `js/storage.js`
- `js/nutri-ai.js`
- `js/charts.js`
- `js/export.js`
- `js/settings.js`
- `js/pwa.js`
- `js/app.js`
- `assets/icons/`
- `assets/images/`

## Uso

Abra o projeto por um servidor local ou publique a pasta inteira em um host estatico, como GitHub Pages. Para instalar como PWA no iPhone, iPad, Android ou desktop, mantenha `manifest.json`, `sw.js` e os icones publicados junto com o `index.html`.

## Configurar Nutri IA

1. Abra o app.
2. Entre em `Ajustes`.
3. Cole sua chave da OpenAI no campo `Chave da OpenAI`.
4. Mantenha o modelo sugerido ou informe outro modelo multimodal compativel com a Responses API.
5. Salve os ajustes.

A chave fica armazenada somente no navegador, usando armazenamento local. Como este app e totalmente estatico, a chamada para a OpenAI acontece diretamente do dispositivo do usuario. Nao publique sua chave dentro do codigo. O backup JSON exportado nao inclui a chave da OpenAI.

Na aba `Nutri IA`, envie uma foto da refeicao ou descreva o prato em texto. O app solicita JSON estruturado para a API da OpenAI, exibe alimento por alimento, calcula totais e permite adicionar o resultado ao diario alimentar sem duplicar a mesma analise.
