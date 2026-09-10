# Geração de Rotina CSW

Site estático para gerar rotina de **consulta** Consistem a partir de uma especificação em texto.

Publicação sugerida: **GitHub Pages** (`main` / root).

## Uso

1. Informe nome, título e AJ.
2. Cole a especificação (Filtros / Colunas / Botões).
3. Clique em **Gerar .txt** → copiar ou baixar (fase 1; depois evolui para `.mac`).

### Formato da especificação

```
1) Rotina de consulta

Filtros:
Cliente + Display
Representante + Display
Situação do Pedido = multiseleção
Periodo Inicial -> Data Final
Previsão Inicial -> Previsão Final

Colunas:
Pedido
Situação
Cliente
...

Botões:
Consultar
Limpar
```

### O que o gerador monta

- Esqueleto `0000` / `0500` / filtros / `1999` / `2000` (grid + AG) / `2999` / `8000` / `9000` / `9999`
- `Valcp*` + `Validate` + `Show` + `TbCellClick`
- `TABGRID` + `gridCols` (tipo estimado: `a` / `d` / `n` / `v2` / `v3`)
- Tags CSW (`label`, `display`, `btnConsultar`, `labelcreate`)

### Limitações (MVP)

- Chamadas `^NOMERG` ficam como stub (regra de negócio à parte).
- Multiselect de representante no estilo `SELREP` só quando o filtro é “Representante + Display”.
- Larguras/tipos de coluna são heurísticos — ajuste fino no `.txt` gerado ou depois no CamposCSW.

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
