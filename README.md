# Geração de Rotina CSW

Site estático para gerar rotina de **consulta** Consistem (tela `.mac` + regras `RG.mac`) a partir de uma especificação em texto.

**Site:** https://rapidsoftservicos.github.io/GeracaoRotina/

Publicação: **GitHub Pages** (`main` / root).

## Uso

1. Informe **código da rotina** e **título da tela**. O AJ (colunas × linhas, padrão 108 × 28) fica ao lado de "Configuração".
2. Escreva a especificação (Filtros / Colunas / Botões) — o botão **Formato** mostra a sintaxe.
3. Clique em **Gerar** (ou Ctrl+Enter) → abas **Tela** e **Regras (RG)** → **Copiar** a aba atual ou **Baixar .mac** (os dois arquivos, com CRLF).

O mês/ano do cabeçalho (`; MM/AAAA - TÍTULO`) é preenchido com a data atual.

### Formato da especificação

```
Filtros:                          (* no fim = obrigatório)
Cliente + Display                 código + descrição (F7=LABEL^ROT opcional)
Situação = multiseleção (A, B)    seleção múltipla (%CSUTIMM)
Emissão Inicial -> Emissão Final  período De / Até
Tipo = combo (Normal, Troca)      combo
Ativo = sim/não                   radio Sim/Não
Pedido : inteiro 8                texto | inteiro | data [tamanho]

Colunas:                          Título [: tipo] [: largura]  (padrão: a, 6)
Valor Total ! Pedido : v2 : 12    "!" quebra linha no título; tipos a n d v0 v2 v3 f2

Botões:
Consultar / Limpar                btnConsultar (sempre gerado)
Imprimir                          demais → csw:botao + label 3XXX + 7000(HABBOT)
```

### Exemplo

```
Filtros:
Cliente + Display
Transportadora + Display
Emissão Inicial -> Emissão Final *
Situação da Nota = multiseleção (Emitida, Cancelada, Denegada, Inutilizada)
Tipo de Operação = combo (Venda, Devolução, Remessa, Transferência)

Colunas:
Nota : n : 7
Série : n : 3
Emissão : d : 8
Cliente : a : 22
Transportadora : a : 14
Situação : a : 9
Tipo de ! Operação : a : 11
Qtde. ! Volumes : v0 : 6
Peso ! Bruto : v3 : 8
Valor ! Produtos : v2 : 9
Valor Total ! da Nota : v2 : 10

Botões:
Consultar
Limpar
Imprimir DANFE
Exportar
```

## Padrão gerado

Base: skills Consistem (`interface-consulta`, esqueleto de tela clássica, grid CSW1GRID, CSLE, convenções de código) ajustadas ao padrão do time. Referência real: `PRGBCRRC010` / `PRGBCRRC010RG`.

### Convenções

- Ordem de parâmetros: **empresa, terminal, rotina** e depois o resto — `(CE,CT,%PRG)` na tela, `(codEmpresa,term,rotina)` na RG.
- Sucesso retorna `quit $$$OK` (falha de validação `quit 0`).
- Laços no formato `for ... do` com bloco pontuado (`. ;` na primeira linha); para pular registro, `quit` dentro do bloco.
- Coluna do grid: `Csw=<largura>^<título>^<código da coluna>`.
- Variáveis de tela maiúsculas (6 caracteres); parâmetros da RG em camelCase derivados do rótulo.

### Tela `{CODIGO}.mac`

- `0000` — `New^%CSW1UTI`, **trava** `$$ValidarExecucaoCSW^%CSUTIRG001()` (fixa), `%PRG`/`CT`, `csw:aj` + `AJ^%CSUTIUD`.
- `0500` — kill das seleções, `ObterTab*`/`ObterTabSimNao`/`ObterValoresIniciais` (1º dia do mês), campos vazios, `do 9000`.
- Filtros `1000…` (passo 100, cai para 50/25 com muitos campos) — `ON`/`EX` com navegação `goto 9999:%=27,{anterior}:%=140`.
- `1999` foco no Consultar · `2000` → `AG^%CSUTIUD` → `2000AG1` `GerarGlobalTrabalho(CE,CT,...)` → `GerarGrid(CE,CT,%PRG)` → `FJ`/`FJAG` → `ValidarDisplay` → `Movimentar` · `2999` foco no grid.
- `3XXX` botões extras + `7000(HABBOT)` (desabilitados até o grid ter dados).
- `9000` — `Clear`/`Enable`/`BtnConsultar`, `InicializaCombo`/`InicializaRadio`, `TABGRID` (gridConf com `LabelEdit=TbCellClick`).
- `9999` — `Finalizar^%CSW1GRID` + `ExcluirGlobalTrabalho(CT)` + `FJ`.
- `Valcp*()` e `Validate()` (sem `quit:'$$CSP`), `TbCellClick` **antes** do `Show`, tags `csw:` (label, display, btnConsultar, botao, labelcreate, labeldestroy, csp:gerar).

Layout: o rótulo fica em `COL=1` e a coluna do campo acompanha o maior rótulo (mínimo 16); o display começa 2 colunas depois do campo, com largura até 30.

### Regras `{CODIGO}RG.mac`

- `ObterValoresIniciais` — início dos períodos no 1º dia do mês.
- `ObterTab*` — opções de multiseleção/combo (as informadas entre parênteses, ou `TODO`).
- `ObterDescricao*` — só o `TODO` para usar a regra `Obter*`/`Ver*` do módulo.
- `GerarGlobalTrabalho(codEmpresa,term,...)` — `ExcluirGlobalTrabalho`, ajuste fixo das datas e laço de exemplo comentado com a condição de cada filtro:
  ```objectscript
  set dataAtual=+$$$horolog
  set dataInicio=$select($get(dataInicio)="":"",1:dataInicio-1)
  set dataFim=$select($get(dataFim)="":dataAtual-1,1:dataFim)
  ;. if $data(tabSel)&&('$data(tabSel(codigo))) quit
  ```
- `GerarGrid(codEmpresa,term,rotina)` — percorre a `^mtemp{CODIGO}` (com `TODO` para a estrutura de chaves) e chama `GravarLinha`.
- `GravarLinha(codEmpresa,term,rotina,chave,codRegistro)` — lê `set mtemp{CODIGO}=$get(^mtemp{CODIGO}(term,chave))`, monta `dados`/`detalha` e chama `GravarLinhas^%CSW1GRID(...,$get(codRegistro),,,,,,1)`.
- `ExcluirGlobalTrabalho(term)` e `; csw:csp:naogerar`.

### Avisos

A tela aponta, antes de gerar o fonte:
- título com `%` ou começando com verbo; `%` em rótulo ou coluna (use "Perc.");
- combo sem opções;
- soma das larguras das colunas maior que o grid (as últimas ficam cortadas);
- grid baixo demais ou filtros demais (avaliar abas).

## Limitações

- A leitura do global de negócio fica como `TODO` em `GerarGlobalTrabalho`, `GerarGrid` e `ObterDescricao*`.
- Coluna sem tipo/largura sai `Tipo=a`, `Csw=6` — informe `: tipo : largura` quando precisar.
- Só gera tela de **consulta** (sem cadastro/manutenção em linha).

## Estrutura

```
GeracaoRotina/
├── index.html
├── css/styles.css
├── js/parser.js      especificação → modelo (filtros, colunas, botões)
├── js/generator.js   modelo → tela .mac + RG.mac + avisos
├── js/app.js         interface (abas, copiar, baixar)
└── README.md
```

## GitHub Pages

1. Settings → Pages
2. Deploy from branch `main` / `/ (root)`
3. Aguarde alguns minutos após o push
