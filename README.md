# Bolao Copa Amigos

App recreativo para palpites da Copa do Mundo entre amigos. Sem dinheiro, sem apostas, sem premiacao financeira.

---

## Aviso de isolamento

Este projeto e completamente independente. Nao compartilha codigo, dados ou dependencias com outros projetos
(Farmavet, TotemCafe, Totem Bite ou qualquer outro). Todo o trabalho fica em `C:\BolaoCopaAmigos`.

---

## Stack

- Frontend: HTML + CSS + JavaScript puro (sem frameworks)
- Backend: Node.js sem dependencias externas (apenas modulos nativos)
- Persistencia: `data/store.json` (arquivo JSON local)
- Exportacoes: PDF e CSV gerados no servidor, sem bibliotecas externas

---

## Como rodar

```bash
npm start
```

Acesse em: `http://localhost:4173`

Se a porta estiver ocupada:

```powershell
$env:PORT=4180; npm start
```

Verificar que o servidor esta no ar:

```
GET http://localhost:4173/api/health
→ { "status": "ok" }
```

---

## Login admin

Credenciais padrao de desenvolvimento:

```
Usuario: admin
Senha:   admin123
```

Para alterar antes de usar em producao:

```powershell
$env:ADMIN_USER="seu_usuario"
$env:ADMIN_PASSWORD="sua_senha_segura"
$env:TOKEN_SECRET="chave-secreta-longa-e-aleatoria"
npm start
```

---

## Como importar a tabela de jogos

1. Acesse o painel admin e va em **Importar jogos**.
2. Clique em **Carregar exemplo** para ver o formato, ou baixe `tabela-exemplo.json`.
3. Monte o JSON com `groups` e `matches` conforme o formato abaixo.
4. Cole o JSON na area de texto e clique em **Importar tabela**.
5. Confirme o aviso — um backup e criado automaticamente antes de qualquer alteracao.

### Formato esperado

```json
{
  "groups": [
    {
      "id": "A",
      "name": "Grupo A",
      "teams": ["Brasil", "Serbia", "Suica", "Camaroes"]
    }
  ],
  "matches": [
    {
      "id": "A-1",
      "groupId": "A",
      "date": "2026-06-12",
      "time": "13:00",
      "teamA": "Brasil",
      "teamB": "Serbia"
    }
  ]
}
```

### Regras de validacao

O servidor rejeita o JSON se:

- `groups` ou `matches` forem vazios ou ausentes
- Algum grupo nao tiver `id`, `name` ou menos de 2 times
- Algum jogo nao tiver `groupId`, `teamA` ou `teamB`
- `teamA` ou `teamB` nao pertencerem ao grupo indicado em `groupId`
- `teamA === teamB` (time jogando contra si mesmo)
- `date` fora do formato `YYYY-MM-DD` ou `time` fora de `HH:MM`

Palpites existentes so sao apagados se a validacao passar totalmente.

---

## Como fazer backup manual

O backup e criado automaticamente a cada importacao de tabela, salvo em:

```
data/store-backup-YYYY-MM-DDTHH-MM-SS.json
```

Para fazer um backup manual pelo terminal:

```powershell
Copy-Item data\store.json "data\store-backup-manual-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
```

Para restaurar um backup:

```powershell
Copy-Item data\store-backup-2026-06-12T14-30-00.json data\store.json
```

Os arquivos em `data/` nao sao rastreados pelo Git (listados no `.gitignore`).

---

## Regra do jogo

Para cada jogo da fase de grupos, o participante escolhe **uma** das tres opcoes:

| Opcao | Codigo |
|-------|--------|
| Time A vence | `A` |
| Empate | `D` |
| Time B vence | `B` |

**Sem palpite de placar. Sem palpite de classificados.**

### Pontuacao

| Resultado | Pontos |
|-----------|--------|
| Acertou o resultado (A, D ou B) | **1 ponto** |
| Errou | 0 pontos |

O resultado real e informado pelo admin por placar (`scoreA x scoreB`).
O sistema converte automaticamente: `scoreA > scoreB` = A, `scoreA = scoreB` = D, `scoreB > scoreA` = B.

---

## Funcionalidades

- Cadastro com nome e celular (WhatsApp)
- Numero de inscricao sequencial + ID unico de acesso
- Palpites de placar para cada jogo da fase de grupos
- Selecao de dois classificados por grupo
- Bloqueio automatico por prazo ou bloqueio manual no admin
- Painel admin com login protegido por token HMAC-SHA256
- Edicao e exclusao de participante pelo admin
- Lancamento de resultados reais e recalculo automatico de pontuacao
- Ranking publico em tempo real
- Exportacao de ranking em PDF e CSV, protegida por autenticacao admin (`GET /api/admin/exports/ranking.pdf` e `.csv`)
- Link e mensagem pronta para compartilhar via WhatsApp
- Importacao de tabela de jogos com validacao completa e backup automatico
- Busca de inscricao por celular (`GET /api/participants/search?phone=`)
- Link pessoal `?id=UUID` para acesso direto aos palpites
- Ranking publico sem exposicao de telefones
