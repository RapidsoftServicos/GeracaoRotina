/* Gerador — tela de consulta (.mac) + regras (RG.mac) no padrão Consistem
 *
 * Fontes do padrão (plugin csw): interface-consulta, esqueleto-tela-classica,
 * grid-csw1grid, csle-leitor-campos, invariantes e convencoes-codigo.
 */

window.GeracaoRotina = window.GeracaoRotina || {};

(function (NS) {
  // Label em COL=1 com LARGURA=L encaixa no campo em COL=1+L (mínimo 15, cresce com o maior rótulo)
  function larguraLabel(model) {
    const maior = Math.max(0, ...model.filters.map((f) => f.label.length + 1));
    return Math.min(30, Math.max(15, maior));
  }

  function unique(list) {
    return [...new Set(list.filter(Boolean))];
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  // Cabeçalho de label principal: ";" / "; Descrição" / ";"
  function hdr(desc) {
    return ["\t;", `\t; ${desc}`, "\t;"];
  }

  function hoje() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function tamCampo(f) {
    switch (f.kind) {
      case "data":
      case "periodo":
        return 8;
      case "inteiro":
      case "display":
        return f.tam || 8;
      case "multiselect":
        return 9;
      case "combo":
        return Math.max(12, ...f.opcoes.map((o) => o.length + 4));
      case "simnao":
        return 10;
      default:
        return f.tam || 20;
    }
  }

  function passoLabels(qtd) {
    if (qtd <= 10) return 100;
    if (qtd <= 20) return 50;
    return 25;
  }

  /* ------------------------------------------------------------------ */
  /* Layout: numeração de labels, linhas e colunas                       */
  /* ------------------------------------------------------------------ */

  function assignLayout(cfg, model) {
    const blocos = model.filters.reduce((n, f) => n + (f.kind === "periodo" ? 2 : 1), 0);
    const passo = passoLabels(blocos);
    const colBtn = cfg.ajCols - 11;
    const largLabel = larguraLabel(model);
    const COL_CAMPO = 1 + largLabel;
    let labelNum = 1000;
    let lin = 1;
    const next = () => {
      const n = labelNum;
      labelNum += passo;
      return n;
    };

    const items = model.filters.map((f) => {
      const it = { ...f, lin, col: COL_CAMPO, tam: tamCampo(f) };
      it.labelNum = next();
      if (f.kind === "periodo") {
        it.labelNumAte = next();
        it.colLabelAte = COL_CAMPO + it.tam + 4;
        it.colAte = it.colLabelAte + 4;
      }
      if (f.kind === "display") {
        it.dsId = `ds${it.labelNum}`;
        // ~2 colunas de folga entre o fim do campo e o display
        it.dsCol = COL_CAMPO + it.tam + 2;
        it.dsTam = Math.max(10, Math.min(30, colBtn - 2 - it.dsCol));
      }
      it.lastLabel = it.labelNumAte || it.labelNum;
      lin += 1;
      return it;
    });

    const lastLin = items.length ? items[items.length - 1].lin : 1;
    const temBotoes = model.buttons.extras.length > 0;
    const linPos = lastLin + 2;
    const linIni = linPos + 2;
    const linFim = cfg.ajRows - (temBotoes ? 4 : 3);
    const grid = {
      linPos,
      linIni,
      linFim,
      altura: linFim - linIni,
      colFim: cfg.ajCols - 1,
    };

    // Botões extras: abaixo do grid (LinFim + 4), labels 3XXX
    const usados = new Set(["c", "l"]);
    const botoes = model.buttons.extras.map((titulo, i) => {
      const limpo = titulo.trim();
      const nome = "bt" + NS.util.pascal(limpo);
      let idx = [...limpo].findIndex((ch) => /[A-Za-zÀ-ú]/.test(ch) && !usados.has(ch.toLowerCase()));
      if (idx < 0) idx = 0;
      const atalho = limpo[idx];
      usados.add(atalho.toLowerCase());
      const tituloTag = limpo.slice(0, idx) + `<u>${atalho}</u>` + limpo.slice(idx + 1);
      return {
        titulo: limpo,
        nome,
        atalho,
        tituloTag,
        label: 3000 + i * 100,
        col: 1 + i * 13,
        lin: linFim + 4,
      };
    });

    return { items, grid, botoes, passo, colBtn, blocos, largLabel };
  }

  /* ------------------------------------------------------------------ */
  /* Variáveis                                                           */
  /* ------------------------------------------------------------------ */

  function varsTela(items) {
    const base = ["%TR", "%PRG", "CT", "TABGRID", "SN", "sc"];
    const extras = [];
    for (const f of items) {
      if (f.kind === "periodo") extras.push(f.varDe, f.varAte);
      else if (f.kind === "multiselect") extras.push(f.tabVar, f.selVar);
      else if (f.kind === "combo") extras.push(f.varName, f.tabVar);
      else if (f.kind === "simnao") extras.push(f.varName, "TABSIM");
      else if (f.kind === "display") extras.push(f.varName, f.descVar);
      else extras.push(f.varName);
    }
    return unique([...base, ...extras]);
  }

  function argsGlobalTrabalho(items) {
    const parts = ["CE", "CT"];
    for (const f of items) {
      if (f.kind === "periodo") parts.push(f.varDe, f.varAte);
      else if (f.kind === "multiselect") parts.push(`.${f.selVar}`);
      else parts.push(f.varName);
    }
    return parts.join(",");
  }

  function paramsGlobalTrabalho(items) {
    const parts = ["codEmpresa", "term"];
    for (const f of items) {
      if (f.kind === "periodo") parts.push(f.paramDe, f.paramAte);
      else parts.push(f.param);
    }
    return parts;
  }

  /* ------------------------------------------------------------------ */
  /* TELA — {NOME}.mac                                                   */
  /* ------------------------------------------------------------------ */

  function flag1(f, resto) {
    const obr = f.obrigatorio ? "1" : "";
    return resto ? `"${obr},${resto}"` : f.obrigatorio ? "1" : "";
  }

  function raux(f, labelNum) {
    return `",${f.f7 || ""},,cp${labelNum}"`;
  }

  function saida(labelNum, anterior, sufixo = "EX") {
    if (anterior == null) return `${labelNum}${sufixo}\tgoto 9999:%=27!(%=140)`;
    return `${labelNum}${sufixo}\tgoto 9999:%=27,${anterior}:%=140`;
  }

  function gen0000(cfg, vars) {
    const L = [];
    chunk(vars, 14).forEach((ch, i) => {
      const list = ch.join(",");
      L.push(`${i === 0 ? "0000" : ""}\tdo New^%CSW1UTI("${list}")`);
      L.push(`\tnew ${list}`);
    });
    L.push(
      "\t;",
      "\t; Trava de execução",
      `\tset sc=$$ValidarExecucaoCSW^${cfg.trava}()`,
      "\tif $$$ISERR(sc) do ME^%CSUTICSP(sc) quit",
      "\t;",
      `\tset %PRG="${cfg.nome}",CT=%index`,
      "\t;",
      `\t; csw:aj:${cfg.ajCols},${cfg.ajRows},${cfg.titulo}`,
      `\tdo AJ^%CSUTIUD(${cfg.ajCols},${cfg.ajRows},"${cfg.titulo}")`
    );
    return L;
  }

  function gen0500(cfg, items) {
    const rg = cfg.nome + "RG";
    const kills = [];
    const L = [...hdr("Iniciar variáveis")];
    for (const f of items) {
      if (f.kind === "multiselect") kills.push(f.selVar, f.tabVar);
      if (f.kind === "combo") kills.push(f.tabVar);
    }
    if (items.some((f) => f.kind === "simnao")) kills.push("TABSIM");
    L.push(`0500\tkill ${unique(kills.length ? kills : ["TABGRID"]).join(",")}`);
    L.push("\t;");

    let temCarga = false;
    for (const f of items) {
      if (f.kind === "multiselect" || f.kind === "combo") {
        L.push(`\tset sc=$$${f.regraTab}^${rg}(.${f.tabVar})`);
        temCarga = true;
      }
    }
    if (items.some((f) => f.kind === "simnao")) {
      L.push(`\tset sc=$$ObterTabSimNao^%CSW1E(.TABSIM)`);
      temCarga = true;
    }
    const periodos = items.filter((f) => f.kind === "periodo");
    if (periodos.length) {
      L.push(`\tset sc=$$ObterValoresIniciais^${rg}(${periodos.map((p) => "." + p.varDe).join(",")})`);
      temCarga = true;
    }
    if (temCarga) L.push("\t;");

    const vazios = items
      .filter((f) => !["periodo", "multiselect"].includes(f.kind))
      .flatMap((f) => (f.kind === "display" ? [f.varName, f.descVar] : [f.varName]));
    if (vazios.length) L.push(`\tset (${unique(vazios).join(",")})=""`);
    if (periodos.length) L.push(`\tset (${periodos.map((p) => p.varAte).join(",")})=+$$$horolog`);
    if (vazios.length || periodos.length) L.push("\t;");
    L.push("\tdo 9000");
    return L;
  }

  function genFiltros(cfg, items) {
    const L = [];
    items.forEach((f, idx) => {
      const ant = idx > 0 ? items[idx - 1].lastLabel : null;
      const n = f.labelNum;
      L.push("\t;", `\t; ${f.label}`, `${n}\t;`);

      switch (f.kind) {
        case "display":
          L.push(`${n}ON\tdo Set^%CSW1UTI(%PRG,"${f.dsId}","")`);
          L.push(`\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},"@'?.N",${flag1(f)},,${raux(f, n)})`);
          break;
        case "inteiro":
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},"@'?.N",${flag1(f)},,${raux(f, n)})`);
          break;
        case "data":
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},,${flag1(f, "1,3")},,${raux(f, n)})`);
          break;
        case "combo":
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},,${flag1(f)},,${raux(f, n)},,,,,1,.${f.tabVar})`);
          break;
        case "simnao":
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},,${flag1(f)},,${raux(f, n)},,,,,3,.TABSIM)`);
          break;
        case "multiselect":
          L.push(
            `${n}ON\tdo ^%CSUTIMM("${f.tabVar}","1",,,"1,0","${f.selVar}","${f.label}",,,,,,,"${n}MM1^${cfg.nome}","${f.col},${f.lin},${f.tam},${n}^${cfg.nome}")`
          );
          L.push("\tquit:$$CSP^%CSW1UTI()");
          L.push(ant == null ? `${n}MM1\tgoto 9999:%=27!(%=140)` : `${n}MM1\tgoto ${ant}:%=27!(%=140)`);
          L.push(`\tif '$$Valcp${n}() goto ${n}`);
          return;
        case "periodo":
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varDe}",${f.varDe},,${flag1(f, "1,3")},,${raux(f, n)})`);
          L.push("\tquit:$$CSP^%CSW1UTI()");
          L.push(saida(n, ant));
          L.push(`\tif '$$Valcp${n}() goto ${n}`);
          L.push("\t;", `\t; ${f.labelAte}`, `${f.labelNumAte}\t;`);
          L.push(
            `${f.labelNumAte}ON\tdo ^%CSLE(${f.lin},${f.colAte},${f.tam},"${f.varAte}",${f.varAte},,${flag1(f, "1,3")},,${raux(f, f.labelNumAte)})`
          );
          L.push("\tquit:$$CSP^%CSW1UTI()");
          L.push(saida(f.labelNumAte, n));
          L.push(`\tif '$$Valcp${f.labelNumAte}() goto ${f.labelNumAte}`);
          return;
        default:
          L.push(`${n}ON\tdo ^%CSLE(${f.lin},${f.col},${f.tam},"${f.varName}",${f.varName},,${flag1(f)},,${raux(f, n)})`);
      }
      L.push("\tquit:$$CSP^%CSW1UTI()");
      L.push(saida(n, ant));
      L.push(`\tif '$$Valcp${n}() goto ${n}`);
    });
    return L;
  }

  function genConsulta(cfg, lay) {
    const rg = cfg.nome + "RG";
    const ultimo = lay.items.length ? lay.items[lay.items.length - 1].lastLabel : "1999";
    const L = [];
    L.push(...hdr("Consultar"), `1999\tdo Focus^%CSW1UTI(%PRG,"btConsultar",,1) quit`);
    L.push(
      ...hdr("Gerar grid"),
      `2000\tif '$$Validate() quit:$$CSP^%CSW1UTI()`,
      "\t;",
      `\tset sc=$$Limpar^%CSW1GRID(CT,%PRG,1)`,
      `\tset sc=$$Inicializar^%CSW1GRID(CT,%PRG,1,.TABGRID)`,
      `\tif $$$ISERR(sc) do ME^%CSUTICSP(sc) goto 1999`,
      "\t;",
      `\tdo AG^%CSUTIUD(,"2000AG1^${cfg.nome}")`,
      "\tquit:$$CSP^%CSW1UTI()",
      "\t;",
      `2000AG1\tset sc=$$GerarGlobalTrabalho^${rg}(${argsGlobalTrabalho(lay.items)})`,
      `\tif $$$ISOK(sc) set sc=$$GerarGrid^${rg}(CE,CT,%PRG)`,
      "\t;",
      "\tdo FJ^%CSUTIUD",
      "\tdo FJAG^%CSW1UTI",
      "\t;",
      "\tif $$$ISERR(sc) do ME^%CSUTICSP(sc) goto 1999",
      "\t;",
      `\tset sc=$$ValidarDisplay^%CSW1GRID(CT,%PRG,1)`,
      `\tif $$$ISERR(sc) do ME^%CSUTICSP(sc) goto ${ultimo}`,
      "\t;",
      `\tset sc=$$Movimentar^%CSW1GRID(CT,%PRG,1,,1)`
    );
    if (lay.botoes.length) L.push("\t;", "\tdo 7000(1)");
    L.push(...hdr("Foco no grid"), `2999\tdo Focus^%CSW1GRID3(CT,%PRG,1,1) quit`);
    return L;
  }

  function genAcoes(lay) {
    const L = [];
    for (const b of lay.botoes) {
      L.push(...hdr(b.titulo), `${b.label}\t; TODO: implementar a ação "${b.titulo}" (delegar à regra)`, "\tgoto 2999");
    }
    if (lay.botoes.length) {
      L.push(...hdr("Habilitar/desabilitar botões"), `7000(HABBOT)\t;`, "\tset HABBOT=$get(HABBOT)");
      for (const b of lay.botoes) L.push(`\tdo HabBotGeral^%CSW1("${b.nome}",HABBOT)`);
      L.push("\tquit");
    }
    return L;
  }

  function gen9000(cfg, model, lay) {
    const g = lay.grid;
    const L = [...hdr("Tela")];
    L.push("9000\tdo Clear^%CSW1UTI()", "\tdo Enable^%CSW1UTI()", "\tdo BtnConsultar^%CSW1D(1)");
    if (lay.botoes.length) L.push("\tdo 7000(0)");

    const inits = [];
    for (const f of lay.items) {
      if (f.kind === "combo") inits.push(`\tdo InicializaCombo^%CSW1A("cp${f.labelNum}",.${f.tabVar},0,${f.varName},,,1)`);
      if (f.kind === "simnao") inits.push(`\tdo InicializaRadio^%CSW1A("cp${f.labelNum}",.TABSIM,0,${f.varName},,,1)`);
    }
    if (inits.length) L.push("\t;", ...inits);

    L.push("\t;", "\tkill TABGRID");
    L.push(
      `\tset TABGRID(1)="; csw:gridConf:cod=1; LinPos=${g.linPos}; Altura=${g.altura}; LinIni=${g.linIni}; LinFim=${g.linFim}; ColIni=1; ColFim=${g.colFim}; HabilitaNavegacao=1; LabelEdit=TbCellClick^${cfg.nome};"`
    );
    model.columns.forEach((col, i) => {
      const alin = /^(n|v\d?|f\d)$/.test(col.tipo) ? " Alin=D;" : "";
      L.push(`\tset TABGRID(1,${i + 1})="; csw:gridCols:cod=1; Tipo=${col.tipo};${alin}\tCsw=${col.width}^${col.name}^${i + 1};"`);
    });
    L.push(
      "\t;",
      `\tset sc=$$Inicializar^%CSW1GRID(CT,%PRG,1,.TABGRID)`,
      `\tset sc=$$Limpar^%CSW1GRID(CT,%PRG,1)`,
      "\tquit"
    );
    return L;
  }

  function gen9999(cfg) {
    return [
      ...hdr("Fim"),
      `9999\tset sc=$$Finalizar^%CSW1GRID(CT,%PRG,1)`,
      `\tset sc=$$ExcluirGlobalTrabalho^${cfg.nome}RG(CT)`,
      "\t;",
      "\tdo FJ^%CSUTIUD",
      "\tdo FJ^%CSW1UTI",
      "\tquit",
    ];
  }

  function msgObrig(label) {
    return `do ME^%CSUTIUD("${label}: campo obrigatório!") quit 0`;
  }

  function genValcps(cfg, items) {
    const rg = cfg.nome + "RG";
    const L = [];
    const abre = (n, label) => L.push("\t;", `\t; Validar ${label}`, "\t;", `Valcp${n}()\t;`);

    for (const f of items) {
      const n = f.labelNum;
      if (f.kind === "periodo") {
        abre(n, f.label);
        if (f.obrigatorio) L.push(`\tif ${f.varDe}="" ${msgObrig(f.label)}`);
        L.push("\tquit $$$OK");
        abre(f.labelNumAte, f.labelFim);
        if (f.obrigatorio) L.push(`\tif ${f.varAte}="" ${msgObrig(f.labelFim)}`);
        L.push(
          `\tif ${f.varDe}'="",${f.varAte}'="",${f.varDe}>${f.varAte} do ME^%CSUTIUD("${f.labelFim} menor que a inicial!") quit 0`,
          "\tquit $$$OK"
        );
        continue;
      }
      abre(n, f.label);
      switch (f.kind) {
        case "display":
          if (f.obrigatorio) L.push(`\tif ${f.varName}="" ${msgObrig(f.label)}`);
          else L.push(`\tif ${f.varName}="" do Set^%CSW1UTI(%PRG,"${f.dsId}","Todos") quit $$$OK`);
          L.push(
            "\t;",
            `\tset sc=$$${f.regraDesc}^${rg}(CE,${f.varName},.${f.descVar})`,
            "\tif $$$ISERR(sc) do ME^%CSUTICSP(sc) quit 0",
            "\t;",
            `\tdo Set^%CSW1UTI(%PRG,"${f.dsId}",${f.descVar})`
          );
          break;
        case "multiselect":
          if (f.obrigatorio) L.push(`\tif '$data(${f.selVar}) do ME^%CSUTIUD("${f.label}: selecione ao menos uma opção!") quit 0`);
          else L.push(`\tif '$data(${f.selVar}) do Set^%CSW1UTI(%PRG,"cp${n}MM1","Todos")`);
          break;
        case "inteiro":
          if (f.obrigatorio) L.push(`\tif ${f.varName}="" ${msgObrig(f.label)}`);
          L.push(`\tif ${f.varName}'="",${f.varName}'?1.N do ME^%CSUTIUD("${f.label}: valor inválido! ("_${f.varName}_")") quit 0`);
          break;
        default:
          if (f.obrigatorio) L.push(`\tif ${f.varName}="" ${msgObrig(f.label)}`);
      }
      L.push("\tquit $$$OK");
    }
    return L;
  }

  function genValidate(items) {
    const L = [...hdr("Validar filtros"), "Validate()\t;"];
    for (const f of items) {
      for (const n of f.kind === "periodo" ? [f.labelNum, f.labelNumAte] : [f.labelNum]) {
        L.push(`\tif '$$Valcp${n}() do Focus^%CSW1UTI(%PRG,"cp${n}") quit 0`);
      }
    }
    L.push("\t;", "\tquit $$$OK");
    return L;
  }

  function genClickShow(cfg) {
    return [
      ...hdr("Clique na célula do grid"),
      "TbCellClick(%cswLin,%cswCol)\t;",
      "\tgoto 2999",
      ...hdr("Ponto de entrada"),
      "Show(%cswP1,%cswP2,%cswP3,%cswP4)\t;",
      `\tdo Show^%CSW1UTI("${cfg.nome}",$get(%cswP1),$get(%cswP2),$get(%cswP3),$get(%cswP4))`,
      "\t;",
      "\tquit",
    ];
  }

  function genTags(cfg, lay) {
    const L = ["\t;"];
    for (const f of lay.items) {
      L.push(`\t; csw:label:1,${f.lin},${lay.largLabel},${f.label}`);
      if (f.kind === "periodo") L.push(`\t; csw:label:${f.colLabelAte},${f.lin},4,${f.labelAte}`);
    }
    const displays = lay.items.filter((f) => f.kind === "display");
    if (displays.length) {
      L.push("\t;");
      for (const f of displays) L.push(`\t; csw:display:${f.dsCol},${f.lin},${f.dsTam},${f.dsId}`);
    }
    L.push("\t;", `\t; csw:btnConsultar:${lay.colBtn},1,2000^${cfg.nome},0500^${cfg.nome}`);
    for (const b of lay.botoes) {
      L.push(`\t; csw:botao:${b.col},${b.lin},${b.nome},${b.tituloTag},${b.atalho},${b.label}^${cfg.nome},,,10`);
    }
    L.push("\t;", `\t; csw:labelcreate:${cfg.nome}`, "\t; csw:labeldestroy:9999", "\t; csw:csp:gerar");
    return L;
  }

  function generateTela(cfg, model, lay) {
    const vars = varsTela(lay.items);
    return [
      `ROUTINE ${cfg.nome}`,
      `${cfg.nome}\t; ${cfg.mesAno} - ${String(cfg.titulo).toUpperCase()}`,
      "\t;",
      "\t#include %CSUTICSP",
      "\t;",
      ...gen0000(cfg, vars),
      ...gen0500(cfg, lay.items),
      ...genFiltros(cfg, lay.items),
      ...genConsulta(cfg, lay),
      ...genAcoes(lay),
      ...gen9000(cfg, model, lay),
      ...gen9999(cfg),
      ...genValcps(cfg, lay.items),
      ...genValidate(lay.items),
      ...genClickShow(cfg),
      ...genTags(cfg, lay),
      "",
    ].join("\n");
  }

  /* ------------------------------------------------------------------ */
  /* REGRAS — {NOME}RG.mac                                               */
  /* ------------------------------------------------------------------ */

  function newLines(vars, porLinha = 10) {
    return chunk(unique(vars), porLinha).map((ch) => `\tnew ${ch.join(",")}`);
  }

  function regra(cfg, desc, assinatura, chamada, corpo) {
    const rg = cfg.nome + "RG";
    const L = ["\t;", `\t; ${desc}`];
    if (cfg.autor) L.push(`\t; (${cfg.autor} - ${hoje()})`);
    const [label, args] = chamada.split(/\((.*)\)$/s);
    L.push("\t;", `\t; set sc=$$${label}^${rg}(${args || ""})`, `${assinatura}\t;`, "\t$$$VAR", ...corpo);
    return L;
  }

  // Condição comentada de cada filtro dentro do laço do global de negócio
  function dicaFiltro(f) {
    let valor = NS.util.camel(f.label);
    if (valor === f.param) valor += "Registro";
    switch (f.kind) {
      case "periodo":
        return [`\t;. if (${valor}'>${f.paramDe})!(${valor}>${f.paramAte}) quit`];
      case "multiselect":
        return [`\t;. if $data(${f.param})&&('$data(${f.param}(${valor}))) quit`];
      case "display":
        return [`\t;. if (${f.param}'=""),(${valor}'=${f.param}) quit`];
      default:
        return [`\t;. if (${f.param}'=""),(${valor}'=${f.param}) quit`];
    }
  }

  function generateRG(cfg, model, lay) {
    const rg = cfg.nome + "RG";
    const mtemp = `^mtemp${cfg.nome}`;
    const L = [
      `ROUTINE ${rg}`,
      `${rg}\t; ${cfg.mesAno} - REGRAS DE ${String(cfg.titulo).toUpperCase()}`,
      "\t;",
      "\t#include %CSUTICSP",
    ];

    // Valores iniciais dos períodos
    const periodos = lay.items.filter((f) => f.kind === "periodo");
    if (periodos.length) {
      const ps = periodos.map((p) => p.paramDe);
      L.push(
        ...regra(cfg, "Obter valores iniciais dos filtros", `ObterValoresIniciais(${ps.join(",")})`, `ObterValoresIniciais(${ps.map((p) => "." + p).join(",")})`, [
          "\tnew dataHoje",
          "\t;",
          "\tset dataHoje=+$$$horolog",
          "\t;",
          "\t; Primeiro dia do mês atual",
          `\tset ${ps.length > 1 ? `(${ps.join(",")})` : ps[0]}=dataHoje-$piece($zdate(dataHoje,4),"/",1)+1`,
          "\t;",
          "\tquit $$$OK",
        ])
      );
    }

    // Tabelas de multiseleção / combo
    for (const f of lay.items.filter((x) => x.kind === "multiselect" || x.kind === "combo")) {
      const corpo = ["\tkill tabela", "\t;"];
      if (f.opcoes && f.opcoes.length) f.opcoes.forEach((o, i) => corpo.push(`\tset tabela(${i + 1})="${o}"`));
      else corpo.push(`\t; TODO: carregar as opções de "${f.label}"`, `\tset tabela(1)="Opção 1"`);
      corpo.push("\t;", "\tquit $$$OK");
      L.push(...regra(cfg, `Obter tabela de ${f.label.toLowerCase()}`, `${f.regraTab}(tabela)`, `${f.regraTab}(.tabela)`, corpo));
    }

    // Descrições dos campos com display
    for (const f of lay.items.filter((x) => x.kind === "display")) {
      L.push(
        ...regra(cfg, `Obter descrição de ${f.label.toLowerCase()}`, `${f.regraDesc}(codEmpresa,codigo,descricao)`, `${f.regraDesc}(codEmpresa,codigo,.descricao)`, [
          "\t;",
          `\t; TODO: usar a regra Obter*/Ver* do módulo de ${f.label.toLowerCase()}`,
          "\t;",
          "\tquit $$$OK",
        ])
      );
    }

    // Global de trabalho
    const params = paramsGlobalTrabalho(lay.items);
    const chamadaGT = params.map((p) => (lay.items.some((f) => f.kind === "multiselect" && f.param === p) ? "." + p : p)).join(",");
    const dicas = lay.items.flatMap(dicaFiltro);
    // Ajuste padrão dos períodos: início -1 (para o $order) e fim vazio = ontem
    const ajustePeriodos = periodos.length
      ? [
          "\tset dataAtual=+$$$horolog",
          ...periodos.flatMap((p) => [
            `\tset ${p.paramDe}=$select($get(${p.paramDe})="":"",1:${p.paramDe}-1)`,
            `\tset ${p.paramAte}=$select($get(${p.paramAte})="":dataAtual-1,1:${p.paramAte})`,
          ]),
          "\t;",
        ]
      : [];
    L.push(
      ...regra(cfg, "Gerar global de trabalho", `GerarGlobalTrabalho(${params.join(",")})`, `GerarGlobalTrabalho(${chamadaGT})`, [
        `\tnew sc,chave,dados${periodos.length ? ",dataAtual" : ""}`,
        "\t;",
        "\tset sc=$$ExcluirGlobalTrabalho(term)",
        "\t;",
        ...ajustePeriodos,
        "\t; TODO: percorrer o global de negócio aplicando os filtros e gravar",
        `\t; uma linha por registro em ${mtemp}(term,chave), com os pieces na`,
        "\t; mesma ordem das colunas do grid (ver GravarLinha)",
        "\t;",
        "\t;set chave=\"\"",
        "\t;for  set chave=$order(^GLOBAL(codEmpresa,chave)) quit:chave=\"\"  do",
        "\t;. ;",
        ...dicas,
        "\t;. ;",
        `\t;. set ${mtemp}(term,chave)=dados`,
        "\t;",
        "\tquit $$$OK",
      ])
    );

    L.push(
      ...regra(cfg, "Gerar grid", "GerarGrid(codEmpresa,term,rotina)", "GerarGrid(codEmpresa,term,rotina)", [
        "\tnew sc,chave",
        "\t;",
        `\t; TODO: percorrer a ${mtemp} na mesma estrutura de chaves gravada no GerarGlobalTrabalho`,
        "\tset chave=\"\"",
        `\tfor  set chave=$order(${mtemp}(term,chave)) quit:chave=""  do`,
        "\t. ;",
        "\t. set sc=$$GravarLinha(codEmpresa,term,rotina,chave)",
        "\t;",
        "\tquit $$$OK",
      ])
    );

    const cols = model.columns;
    const varMtemp = `mtemp${cfg.nome}`;
    L.push(
      ...regra(
        cfg,
        "Gravar linha do grid",
        "GravarLinha(codEmpresa,term,rotina,chave,codRegistro)",
        "GravarLinha(codEmpresa,term,rotina,chave)",
        [
          ...newLines(["sc", varMtemp, "dados", "display", "detalha", ...cols.map((c) => c.param)]),
          "\t;",
          "\tset (dados,display,detalha)=\"\"",
          "\t;",
          `\tset ${varMtemp}=$get(${mtemp}(term,chave))`,
          ...cols.map((c, i) => `\tset ${c.param}=$piece(${varMtemp},z,${i + 1})`),
          "\t;",
          ...cols.map((c, i) => `\tset $piece(dados,z,${i + 1})=${c.param}`),
          "\t;",
          "\tset $piece(detalha,z,1)=chave",
          "\t;",
          "\tset sc=$$GravarLinhas^%CSW1GRID(term,rotina,1,dados,display,detalha,$get(codRegistro),,,,,,1)",
          "\t;",
          "\tquit $$$OK",
        ]
      )
    );

    L.push(
      ...regra(cfg, "Excluir global de trabalho", "ExcluirGlobalTrabalho(term)", "ExcluirGlobalTrabalho(term)", [
        "\t;",
        `\tkill ${mtemp}(term)`,
        "\t;",
        "\tquit $$$OK",
      ])
    );

    L.push("\t;", "\t; csw:csp:naogerar", "");
    return L.join("\n");
  }

  /* ------------------------------------------------------------------ */
  /* Avisos de padrão                                                    */
  /* ------------------------------------------------------------------ */

  function avisos(cfg, model, lay) {
    const out = [];
    for (const f of model.filters) out.push(...f.avisos);
    if (/%/.test(cfg.titulo)) out.push('Título com "%" — use "Perc."');
    if (/^(gerar|consultar|listar|emitir|imprimir|calcular|manter|cadastrar|exibir|mostrar)\b/i.test(cfg.titulo))
      out.push("Título não deve começar com verbo (ex.: \"Consulta de…\", não \"Consultar…\").");
    for (const f of model.filters) if (/%/.test(f.label)) out.push(`Filtro "${f.label}" com "%" — use "Perc."`);
    for (const c of model.columns) if (/%/.test(c.name)) out.push(`Coluna "${c.name}" com "%" — use "Perc."`);
    if (lay.blocos > 36) out.push(`${lay.blocos} campos de filtro — avalie dividir em abas (interface-abas).`);
    if (lay.grid.altura < 5) out.push(`Grid com altura ${lay.grid.altura} — muitos filtros para ${cfg.ajRows} linhas.`);
    if (!model.columns.length) out.push("Nenhuma coluna informada — o grid sai vazio.");
    const largGrid = model.columns.reduce((s, c) => s + c.width, 0);
    if (largGrid > lay.grid.colFim)
      out.push(
        `Colunas somam ${largGrid} de largura, mas o grid tem ${lay.grid.colFim} — as últimas ficam cortadas. Reduza larguras (": tipo : largura") ou colunas.`
      );
    if (!/^[A-Z%][A-Z0-9]*$/.test(cfg.nome)) out.push("Nome da rotina deve ser só letras maiúsculas e números.");
    return out;
  }

  function generate(cfg, model) {
    const lay = assignLayout(cfg, model);
    return {
      tela: generateTela(cfg, model, lay),
      rg: generateRG(cfg, model, lay),
      avisos: avisos(cfg, model, lay),
      meta: {
        nome: cfg.nome,
        filters: lay.items.length,
        columns: model.columns.length,
        botoes: lay.botoes.length,
      },
    };
  }

  NS.generate = generate;
})(window.GeracaoRotina);
