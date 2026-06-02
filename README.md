# Bolao Copa Amigos

Projeto novo e separado para um app recreativo de palpites da Copa do Mundo entre amigos. Nao envolve dinheiro, apostas ou premiacao financeira.

## Stack da primeira versao

- Frontend web estatico em HTML, CSS e JavaScript
- Backend Node.js sem dependencias externas
- Persistencia no servidor em `data/store.json`
- Exportacao de ranking em PDF e CSV

A primeira entrega evita dependencias externas para ficar executavel imediatamente. A persistencia pode ser migrada para SQLite em uma proxima etapa sem mudar as telas principais.

## Rodar localmente

```bash
npm start
```

Acesse:

```text
http://localhost:4173
```

Se a porta estiver ocupada:

```bash
$env:PORT=4180; npm start
```

## Admin

Credenciais padrao de desenvolvimento:

```text
Usuario: admin
Senha: admin123
```

Para trocar:

```bash
$env:ADMIN_USER="seu_usuario"
$env:ADMIN_PASSWORD="sua_senha"
npm start
```

## Funcionalidades

- Cadastro de participante com nome completo e celular WhatsApp
- Geracao de numero de inscricao e ID do participante
- Jogos mockados da primeira fase organizados por grupos
- Palpites de placar por jogo
- Selecao de dois classificados por grupo
- Bloqueio automatico por prazo e bloqueio manual no admin
- Painel admin protegido por login
- Lista de participantes
- Lancamento de resultados reais
- Calculo automatico de pontuacao
- Ranking por posicao, nome, celular, pontos dos jogos, pontos dos classificados e total
- Exportacao de ranking em PDF e CSV
- Link publico e mensagem pronta para WhatsApp, sem API oficial
- Importacao de tabela de jogos via JSON no painel admin

## Pontuacao

- Placar exato: 5 pontos
- Acertou apenas vencedor ou empate: 2 pontos
- Errou vencedor/empate: 0 ponto
- Cada pais classificado corretamente: 25 pontos

## Importar jogos

Formato esperado no painel admin:

```json
{
  "groups": [
    { "id": "A", "name": "Grupo A", "teams": ["Brasil", "Japao", "Canada", "Marrocos"] }
  ],
  "matches": [
    {
      "id": "A-1",
      "groupId": "A",
      "date": "2026-06-12",
      "time": "13:00",
      "teamA": "Brasil",
      "teamB": "Japao",
      "scoreA": null,
      "scoreB": null
    }
  ]
}
```
