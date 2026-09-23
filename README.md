# Geração de Rotina CSW

Site estático para gerar rotina de **consulta** Consistem (tela `.mac` + regras `RG.mac`) a partir de uma especificação em texto.

**Site:** https://rapidsoftservicos.github.io/GeracaoRotina/

Publicação: **GitHub Pages** (`main` / root).

## Uso

1. Informe código da rotina e título.
2. Escreva a especificação (Filtros / Colunas / Botões) — botão **Formato** mostra a sintaxe.
3. Clique em **Gerar** (ou Ctrl+Enter) → abas **Tela** e **Regras (RG)** → copiar ou **Baixar .mac** (dois arquivos, CRLF).

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

### O que o gerador monta

Padrão das skills Consistem (`interface-consulta`, esqueleto de tela clássica, grid CSW1GRID, CSLE, convenções de código).

**Tela `{NOME}.mac`**
- `0000` New + **trava** `ValidarExecucaoCSW` + `csw:aj`/`AJ^%CSUTIUD`
- `0500` inicialização (tabelas e valores iniciais via RG) → filtros `1000…` (passo 100/50/25) com `ON`/`EX`
- `1999` foco no Consultar, `2000` grid (`AG^%CSUTIUD` → `GerarGlobalTrabalho` → `GerarGrid` → `FJAG` → `ValidarDisplay` → `Movimentar`), `2999` foco no grid
- `3XXX` botões extras, `7000(HABBOT)`, `9000` tela + `TABGRID`, `9999` saída
- `Valcp*`, `Validate`, `Show`, `TbCellClick` e as tags `csw:` (label/display/btnConsultar/botao/labelcreate/labeldestroy/csp:gerar)

**Regras `{NOME}RG.mac`**
- `ObterValoresIniciais`, `ObterTab*` (multiseleção/combo), `ObterDescricao*` (display)
- `GerarGlobalTrabalho` (esqueleto com os filtros comentados), `GerarGrid`, `GravarLinha`, `ExcluirGlobalTrabalho`
- `; csw:csp:naogerar`

A tela exibe **avisos** de padrão (título com `%` ou começando com verbo, combo sem opções, grid baixo, muitos filtros).

### Limitações

- A leitura do global de negócio fica como `TODO` em `GerarGlobalTrabalho` e nas `ObterDescricao*`.
- Coluna sem tipo/largura sai `Tipo=a`, `Csw=6` — informe `: tipo : largura` quando precisar.

## Estrutura

```
GeracaoRotina/
├── index.html
├── css/styles.css
├── js/parser.js
├── js/generator.js
├── js/app.js
└── README.md
```

## GitHub Pages

1. Settings → Pages  
2. Deploy from branch `main` / `/ (root)`  
3. Aguarde alguns minutos
