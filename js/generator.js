/* Gerador de .mac — rotina de consulta (padrão PRLPPV600) */

window.GeracaoRotina = window.GeracaoRotina || {};

(function (NS) {
  function lines(...arr) {
    return arr.flat().filter((x) => x !== null && x !== undefined).join("\n");
  }

  function unique(list) {
    const seen = new Set();
    const out = [];
    for (const v of list) {
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  function chunkVars(vars, size = 14) {
    const chunks = [];
    for (let i = 0; i < vars.length; i += size) chunks.push(vars.slice(i, i + size));
    return chunks;
  }

  function assignLayout(model) {
    const items = [];
    let lin = 1;
    let labelNum = 1000;

    for (const f of model.filters) {
      if (f.kind === "periodo") {
        const de = labelNum;
        labelNum += 100;
        const ate = labelNum;
        labelNum += 100;
        items.push({
          ...f,
          labelNum: de,
          labelNumAte: ate,
          lin,
          colCampoDe: 16,
          colLabelAte: 31,
          colCampoAte: 32,
          tamCampo: 6,
          labelTam: 15,
        });
        lin += 1;
      } else if (f.kind === "multiselect") {
        items.push({
          ...f,
          labelNum,
          lin,
          colCampo: 16,
          tamCampo: 9,
          labelTam: 15,
        });
        labelNum += 100;
        lin += 1;
      } else if (f.kind === "campoDisplay") {
        items.push({
          ...f,
          labelNum,
          lin,
          colCampo: 16,
          tamCampo: /CODREP/i.test(f.varName) ? 4 : 12,
          labelTam: 15,
          dsId: `ds${labelNum}`,
          dsCol: /CODREP/i.test(f.varName) ? 24 : 40,
          dsTam: /CODREP/i.test(f.varName) ? 30 : 35,
        });
        labelNum += 100;
        lin += 1;
      } else {
        items.push({
          ...f,
          labelNum,
          lin,
          colCampo: 16,
          tamCampo: f.kind === "data" ? 6 : 12,
          labelTam: 15,
        });
        labelNum += 100;
        lin += 1;
      }
    }

    return { filterItems: items };
  }

  function collectVars(filterItems) {
    const base = ["%TR", "%PRG", "CT", "TABGRID", "SN", "DADDET", "sc", "COLUNA", "OP"];
    const extras = [];
    for (const f of filterItems) {
      if (f.kind === "periodo") {
        extras.push(f.varDe, f.varAte);
        if (f.varDe === "DATINI") extras.push("DATEMI");
      } else if (f.kind === "multiselect") {
        extras.push(f.tabVar, f.selVar);
      } else {
        extras.push(f.varName);
      }
      if (/CODCLI/i.test(f.varName || "")) extras.push("DESCCLI", "CFGCLI", "CLI");
      if (/CODREP/i.test(f.varName || "")) extras.push("SELREP", "REP");
    }
    return unique([...base, ...extras]);
  }

  function prevLabelNum(filterItems, idx) {
    if (idx <= 0) return null;
    const prev = filterItems[idx - 1];
    return prev.kind === "periodo" ? prev.labelNumAte : prev.labelNum;
  }

  function gen0500(cfg, filterItems) {
    const kills = [];
    const setsEmpty = [];
    let hasTabsit = false;
    let hasDat = false;
    let hasPrev = false;

    for (const f of filterItems) {
      if (f.kind === "multiselect") {
        kills.push(f.selVar);
        if (f.tabVar === "TABSIT" || /situa/i.test(f.label)) hasTabsit = true;
      }
      if (f.kind === "periodo") {
        if (f.varDe === "DATINI") hasDat = true;
        if (f.varDe === "PREVIN") hasPrev = true;
      }
      if (f.kind === "campoDisplay" || f.kind === "campo" || f.kind === "data") {
        setsEmpty.push(f.varName);
      }
      if (/CODREP/i.test(f.varName || "")) kills.push("SELREP");
    }

    const L = [];
    L.push(`\t; Iniciar as variaveis`);
    L.push(`\t;`);
    L.push(`0500\t${kills.length ? `kill ${unique(kills).join(",")}` : "kill TABGRID"}`);
    L.push(`\t;`);
    if (hasTabsit) L.push(`\tset sc=$$ObterTabSituacao^${cfg.nome}RG(.TABSIT)`);
    if (hasDat && hasPrev) L.push(`\tset sc=$$InicializarVariaveis^${cfg.nome}RG(.DATINI,.PREVIN)`);
    else if (hasDat) L.push(`\tset sc=$$InicializarVariaveis^${cfg.nome}RG(.DATINI)`);
    else if (hasPrev) L.push(`\tset sc=$$InicializarVariaveis^${cfg.nome}RG(.PREVIN)`);
    L.push(`\t;`);
    const empties = unique([...setsEmpty, "OP"]);
    L.push(`\tset (${empties.join(",")})=""`);
    if (hasDat) L.push(`\tset DATFIM=+$$$horolog`);
    if (hasPrev) L.push(`\tset PREVFN=+$$$horolog`);
    L.push(`\t;`);
    L.push(`\tdo 9000`);
    L.push(`\t;`);
    return L.join("\n");
  }

  function genFilters(cfg, filterItems) {
    const L = [];
    const nome = cfg.nome;

    filterItems.forEach((f, idx) => {
      const back = prevLabelNum(filterItems, idx);

      if (f.kind === "campoDisplay") {
        L.push(`\t; ${f.label}`);
        L.push(`${f.labelNum}\t;`);
        if (/CODREP/i.test(f.varName)) {
          L.push(`${f.labelNum}ON\tdo ClearCp^%CSW1UTI("${f.dsId}")`);
          L.push(`\tdo ^%CSLE(${f.lin},${f.colCampo},${f.tamCampo},"${f.varName}",,"@'?.N",,,",SELREP^CCTELGE299,1,cp${f.labelNum}")`);
        } else {
          L.push(`${f.labelNum}ON\tdo Set^%CSW1UTI(%PRG,"${f.dsId}","")`);
          if (/CODCLI/i.test(f.varName)) {
            L.push(`\tdo ^%CSLE(${f.lin},${f.colCampo},,"${f.varName}",${f.varName},"@'?.N",,,",,,cp${f.labelNum}",",1",,,,,,"CLIENTE^CCCDBRG001(CFGCLI)")`);
          } else {
            L.push(`\tdo ^%CSLE(${f.lin},${f.colCampo},${f.tamCampo},"${f.varName}",${f.varName},,,,",,,cp${f.labelNum}")`);
          }
        }
        L.push(`\tquit:$$CSP^%CSW1UTI()`);
        L.push(`\t;`);
        if (back == null) L.push(`${f.labelNum}EX\tgoto 9999:%=27!(%=140)`);
        else L.push(`${f.labelNum}EX\tgoto 9999:%=27,${back}:%=140`);
        L.push(`\t;`);
        L.push(`\tif '$$Valcp${f.labelNum}() goto ${f.labelNum}`);
        L.push(`\t;`);
      } else if (f.kind === "multiselect") {
        L.push(`\t; ${f.label}`);
        L.push(`\t;`);
        L.push(`${f.labelNum}\t;`);
        L.push(
          `${f.labelNum}ON\tdo ^%CSUTIMM("${f.tabVar}","1",,,"1,0","${f.selVar}","${f.label}",,,,,,,"${f.labelNum}MM1^${nome}","${f.colCampo},${f.lin},${f.tamCampo},${f.labelNum}^${nome}")`
        );
        L.push(`\tquit:$$CSP^%CSW1UTI()`);
        if (back == null) L.push(`${f.labelNum}MM1\tgoto 9999:%=27!(%=140)`);
        else L.push(`${f.labelNum}MM1\tgoto ${back}:%=27!(%=140)`);
        L.push(`\tif '$$Valcp${f.labelNum}() goto ${f.labelNum}`);
        L.push(`\t;`);
      } else if (f.kind === "periodo") {
        L.push(`\t; ${f.labelDe}`);
        L.push(`${f.labelNum}\t;`);
        L.push(`${f.labelNum}ON\tdo ^%CSLE(${f.lin},${f.colCampoDe},${f.tamCampo},"${f.varDe}",${f.varDe},,"1,1,3",,",,1,cp${f.labelNum}")`);
        L.push(`\tquit:$$CSP^%CSW1UTI()`);
        if (back == null) L.push(`${f.labelNum}EX\tgoto 9999:%=27!(%=140)`);
        else L.push(`${f.labelNum}EX\tgoto 9999:%=27,${back}:%=140`);
        L.push(`\t;`);
        L.push(`\tif '$$Valcp${f.labelNum}() goto ${f.labelNum}`);
        L.push(`\t;`);
        L.push(`\t; ${f.labelAte}`);
        L.push(`${f.labelNumAte}\t;`);
        L.push(`${f.labelNumAte}ON\tdo ^%CSLE(${f.lin},${f.colCampoAte},${f.tamCampo},"${f.varAte}",${f.varAte},,"1,1,3",,",,2,cp${f.labelNumAte}")`);
        L.push(`\tquit:$$CSP^%CSW1UTI()`);
        L.push(`${f.labelNumAte}EX\tgoto 9999:%=27,${f.labelNum}:%=140`);
        L.push(`\t;`);
        L.push(`\tif '$$Valcp${f.labelNumAte}() goto ${f.labelNumAte}`);
        L.push(`\t;`);
      } else {
        L.push(`\t; ${f.label}`);
        L.push(`${f.labelNum}\t;`);
        if (f.kind === "data") {
          L.push(`${f.labelNum}ON\tdo ^%CSLE(${f.lin},${f.colCampo},${f.tamCampo},"${f.varName}",${f.varName},,"1,1,3",,",,1,cp${f.labelNum}")`);
        } else {
          L.push(`${f.labelNum}ON\tdo ^%CSLE(${f.lin},${f.colCampo},${f.tamCampo},"${f.varName}",${f.varName},,,,",,,cp${f.labelNum}")`);
        }
        L.push(`\tquit:$$CSP^%CSW1UTI()`);
        if (back == null) L.push(`${f.labelNum}EX\tgoto 9999:%=27!(%=140)`);
        else L.push(`${f.labelNum}EX\tgoto 9999:%=27,${back}:%=140`);
        L.push(`\t;`);
        L.push(`\tif '$$Valcp${f.labelNum}() goto ${f.labelNum}`);
        L.push(`\t;`);
      }
    });

    return L.join("\n");
  }

  function buildRgArgs(filterItems) {
    const parts = ["CT", "CE"];
    for (const f of filterItems) {
      if (f.kind === "periodo") {
        if (f.varDe === "DATINI") parts.push("DATEMI", "DATFIM");
        else parts.push(f.varDe, f.varAte);
      } else if (f.kind === "multiselect") {
        parts.push(`.${f.selVar}`);
      } else if (f.kind === "campoDisplay" && /CODREP/i.test(f.varName)) {
        parts.push(".SELREP");
      } else {
        parts.push(f.varName);
      }
    }
    return unique(parts).join(",");
  }

  function genConsultaGrid(cfg, filterItems) {
    const nome = cfg.nome;
    const rgArgs = buildRgArgs(filterItems);
    return lines(
      `\t; Consultar em CSW`,
      `\t;`,
      `1999\tdo Focus^%CSW1UTI(%PRG,"btConsultar",,1) quit`,
      `\t;`,
      `\t; GERAR GRID`,
      `\t;`,
      `2000\tif '$$Validate() quit:$$CSP^%CSW1UTI()`,
      `\t;`,
      `\tset sc=$$Limpar^%CSW1GRID(CT,%PRG,1)`,
      `\tset sc=$$Inicializar^%CSW1GRID(CT,%PRG,1,.TABGRID)`,
      `\t;`,
      `\tdo AG^%CSUTIUD(,"2000AG^${nome}")`,
      `\tquit:$$CSP^%CSW1UTI()`,
      `\t;`,
      `2000AG\tset sc=$$GerarGlobalTrabalho^${nome}RG(${rgArgs})`,
      `\t;`,
      `\tset sc=$$GerarGrid^${nome}RG(CT,%PRG,CE)`,
      `\t;`,
      `\tdo FJ^%CSUTIUD`,
      `\tdo FJAG^%CSW1UTI`,
      `\t;`,
      `\tset sc=$$ValidarDisplay^%CSW1GRID(CT,%PRG,1)`,
      `\tif sc'=1 do ME^%CSUTICSP(sc) goto 1999`,
      `\t;`,
      `\tset sc=$$Movimentar^%CSW1GRID(CT,%PRG,1,,1)`,
      `\t;`,
      `\tset sc=$$ObterDadosLinha^%CSW1GRID(CT,%PRG,1,,.DADDET)`,
      `\t;`,
      `\t; Foco no grid`,
      `\t;`,
      `2999\tdo Focus^%CSW1GRID3(CT,%PRG,1,1) quit`,
      `\t;`
    );
  }

  function gen8000() {
    return lines(
      `\t; Obter dados da linha`,
      `\t;`,
      `8000\tset sc=$$ObterDadosLinha^%CSW1GRID(CT,%PRG,1,,.DADDET)`,
      `\t;`,
      `\tquit`,
      `\t;`
    );
  }

  function gen9000(cfg, model, filterItems) {
    const lastLin = filterItems.reduce((m, f) => Math.max(m, f.lin), 1);
    const linPos = Math.max(lastLin + 1, 6);
    const linIni = linPos + 2;
    const altura = Math.max(8, cfg.ajRows - linPos);
    const linFim = linPos + altura - 1;
    const colFim = Math.max(40, cfg.ajCols - 1);

    const L = [];
    L.push(`\t; Tela`);
    L.push(`\t;`);
    L.push(`9000\tdo Enable^%CSW1UTI()`);
    L.push(`\tdo Clear^%CSW1UTI()`);
    if (model.buttons.consultar) L.push(`\tdo BtnConsultar^%CSW1D(1)`);
    L.push(`\tdo BtnNavega^%CSW1D(0)`);
    L.push(`\t;`);
    L.push(`\tkill TABGRID`);
    L.push(`\t;`);
    L.push(
      `\tset TABGRID(1)="; csw:gridConf:cod=1; LinPos=${linPos}; Altura=${altura}; LinIni=${linIni}; LinFim=${linFim}; ColIni=1; ColFim=${colFim}; HabilitaNavegacao=1;"`
    );

    model.columns.forEach((col, i) => {
      const n = i + 1;
      const alin = col.tipo === "n" || col.tipo === "v2" || col.tipo === "v3" ? " Alin=D;\t" : "\t\t";
      const totalFlag = /valor|total|qtde|peso/i.test(col.name) ? "^^1" : "";
      const pad = n < 10 ? "\t" : "";
      L.push(
        `\tset TABGRID(1,${n})=";${pad}csw:gridCols:cod=1; Tipo=${col.tipo};${alin}Csw=${col.width}^${col.name}^${n}${totalFlag};"`
      );
    });

    L.push(`\t;`);
    L.push(`\tset sc=$$Inicializar^%CSW1GRID(CT,%PRG,1,.TABGRID)`);
    L.push(`\tset sc=$$Limpar^%CSW1GRID(CT,%PRG,1)`);
    L.push(`\t;`);
    L.push(`\tquit`);
    L.push(`\t;`);
    return L.join("\n");
  }

  function gen9999(cfg) {
    return lines(
      `\t; Fim`,
      `\t;`,
      `9999\tset sc=$$ExcluirGlobalTrabalho^${cfg.nome}RG(CT)`,
      `\tset sc=$$Finalizar^%CSW1GRID(CT,%PRG,1)`,
      `\t;`,
      `\tdo FJ^%CSUTIUD`,
      `\tdo FJ^%CSW1UTI`,
      `\t;`,
      `\tquit`,
      `\t;`
    );
  }

  function genValcps(filterItems) {
    const L = [];
    for (const f of filterItems) {
      if (f.kind === "campoDisplay") {
        L.push(`\t; Metodo Valcp${f.labelNum}()`);
        L.push(`\t;`);
        L.push(`Valcp${f.labelNum}()\t;`);
        L.push(`\t;`);
        if (/CODCLI/i.test(f.varName)) {
          L.push(`\tif ${f.varName}="" do  quit $$$OK`);
          L.push(`\t. do Set^%CSW1UTI(%PRG,"${f.dsId}","Todos")`);
          L.push(`\t;`);
          L.push(`\tset sc=$$ObterDescGrupFinceiroCliente^CCCDBRG001(CE,.${f.varName},.DESCCLI)`);
          L.push(`\t;`);
          L.push(`\tdo Set^%CSW1UTI(%PRG,"${f.dsId}",DESCCLI)`);
          L.push(`\t;`);
          L.push(`\tquit $$$OK`);
        } else if (/CODREP/i.test(f.varName)) {
          L.push(`\tif ${f.varName}'="",${f.varName}'?.N do ME^%CSUTIUD("Representante: valor inválido! ("_${f.varName}_")") quit $$$OK`);
          L.push(`\t;`);
          L.push(`\tif ${f.varName}="",$order(SELREP(""))="" do  quit $$$OK`);
          L.push(`\t. do Set^%CSW1UTI(%PRG,"${f.dsId}","Todos")`);
          L.push(`\t;`);
          L.push(`\tif ${f.varName}="",$order(SELREP(""))'="" do  quit $$$OK`);
          L.push(`\t. do Set^%CSW1UTI(%PRG,"${f.dsId}","Selecionado(s)!")`);
          L.push(`\t;`);
          L.push(`\tset sc=$$VerRepresentante^CCFTRG001(CE,${f.varName},.REP)`);
          L.push(`\tif sc'=1 do ME^%CSUTICSP(sc) quit $$$OK`);
          L.push(`\t;`);
          L.push(`\tdo Set^%CSW1UTI(%PRG,"${f.dsId}",$piece(REP,Z,20))`);
          L.push(`\t;`);
          L.push(`\tquit $$$OK`);
        } else {
          L.push(`\tdo Set^%CSW1UTI(%PRG,"${f.dsId}",${f.varName})`);
          L.push(`\tquit $$$OK`);
        }
        L.push(`\t;`);
      } else if (f.kind === "multiselect") {
        L.push(`\t; Metodo Valcp${f.labelNum}()`);
        L.push(`\t;`);
        L.push(`Valcp${f.labelNum}()\t;`);
        L.push(`\t;`);
        L.push(`\tif '$data(${f.selVar}) do Set^%CSW1UTI(%PRG,"cp${f.labelNum}MM1","Todos")`);
        L.push(`\t;`);
        L.push(`\tquit $$$OK`);
        L.push(`\t;`);
      } else if (f.kind === "periodo") {
        L.push(`\t; Metodo Valcp${f.labelNum}()`);
        L.push(`\t;`);
        L.push(`Valcp${f.labelNum}()\t;`);
        L.push(`\tif ${f.varDe}="" do ME^%CSUTIUD("${f.labelDe}: campo obrigatório!") quit 0`);
        L.push(`\tif ${f.varDe}'="",${f.varDe}'?.N do ME^%CSUTIUD("${f.labelDe}: valor inválido! ("_${f.varDe}_")") quit 0`);
        L.push(`\t;`);
        if (f.varDe === "DATINI") {
          L.push(`\tset DATEMI=${f.varDe}-1`);
          L.push(`\t;`);
        }
        L.push(`\tdo Set^%CSW1UTI(%PRG,"cp${f.labelNum}",$zdate(${f.varDe},4))`);
        L.push(`\t;`);
        L.push(`\tquit $$$OK`);
        L.push(`\t;`);
        L.push(`\t; Metodo Valcp${f.labelNumAte}()`);
        L.push(`\t;`);
        L.push(`Valcp${f.labelNumAte}()\t;`);
        L.push(`\tif ${f.varAte}'="",${f.varAte}'?.N do ME^%CSUTIUD("${f.labelAte}: valor inválido! ("_${f.varAte}_")") quit 0`);
        L.push(`\t;`);
        L.push(`\tif ${f.varDe}>${f.varAte} do ME^%CSUTIUD("${f.labelAte} menor que inicial!") quit 0`);
        L.push(`\t;`);
        L.push(`\tif ${f.varAte}="" do  quit 1`);
        L.push(`\t. set ${f.varAte}=999999`);
        L.push(`\t. do Set^%CSW1UTI(%PRG,"cp${f.labelNumAte}","Fim")`);
        L.push(`\t;`);
        L.push(`\tquit $$$OK`);
        L.push(`\t;`);
      } else {
        L.push(`\t; Metodo Valcp${f.labelNum}()`);
        L.push(`\t;`);
        L.push(`Valcp${f.labelNum}()\t;`);
        L.push(`\tquit $$$OK`);
        L.push(`\t;`);
      }
    }
    return L.join("\n");
  }

  function genValidate(filterItems) {
    const L = [];
    L.push(`\t; Metodo Validate()`);
    L.push(`\t;`);
    L.push(`Validate()\t;`);
    L.push(`\tquit:'$$CSP^%CSW1UTI() 1`);
    for (const f of filterItems) {
      if (f.kind === "periodo") {
        L.push(`\tif '$$Valcp${f.labelNum}() do Focus^%CSW1UTI(%PRG,"cp${f.labelNum}") quit 0`);
        L.push(`\tif '$$Valcp${f.labelNumAte}() do Focus^%CSW1UTI(%PRG,"cp${f.labelNumAte}") quit 0`);
      } else {
        L.push(`\tif '$$Valcp${f.labelNum}() do Focus^%CSW1UTI(%PRG,"cp${f.labelNum}") quit 0`);
      }
    }
    L.push(`\tquit $$$OK`);
    L.push(`\t;`);
    return L.join("\n");
  }

  function genShow(cfg) {
    return lines(
      `\t; Metodo Show`,
      `\t;`,
      `Show(%cswP1,%cswP2,%cswP3,%cswP4)\t;`,
      `\tdo Show^%CSW1UTI("${cfg.nome}",$get(%cswP1),$get(%cswP2),$get(%cswP3),$get(%cswP4))`,
      `\tquit`,
      `\t;`
    );
  }

  function genTbCellClick() {
    return lines(
      `\t; Metodo TbCellClick`,
      `\t;`,
      `TbCellClick(%cswLin,%cswCol)\t;`,
      `\tset COLUNA=$piece(%cswCol,";",1)`,
      `\t;`,
      `\tquit`,
      `\t;`
    );
  }

  function genTags(cfg, model, filterItems) {
    const L = [];
    L.push(`\t; TAGS CSW`);
    L.push(`\t;`);
    for (const f of filterItems) {
      if (f.kind === "periodo") {
        L.push(`\t; csw:label:1,${f.lin},${f.labelTam},${f.labelDe}`);
        L.push(`\t; csw:label:1,${f.lin},${f.colLabelAte},${f.labelAte}`);
      } else {
        L.push(`\t; csw:label:1,${f.lin},${f.labelTam},${f.label}`);
      }
    }
    L.push(`\t;`);
    for (const f of filterItems) {
      if (f.kind === "campoDisplay") {
        L.push(`\t; csw:display:${f.dsCol},${f.lin},${f.dsTam},${f.dsId}`);
      }
    }
    L.push(`\t;`);
    if (model.buttons.consultar || model.buttons.limpar) {
      L.push(`\t; csw:btnConsultar:97,2,2000^${cfg.nome},0500^${cfg.nome}`);
    }
    L.push(`\t;`);
    L.push(`\t; csw:labelcreate:${cfg.nome}`);
    L.push(`\t; csw:labeldestroy:9999`);
    L.push(`\t; csw:csp:gerar`);
    return L.join("\n");
  }

  function generateMac(cfg, model) {
    const { filterItems } = assignLayout(model);
    const vars = collectVars(filterItems);
    const chunks = chunkVars(vars, 14);
    const hasCliente = filterItems.some((f) => /CODCLI/i.test(f.varName || ""));

    const headerNew = [];
    chunks.forEach((ch, idx) => {
      const list = ch.join(",");
      if (idx === 0) {
        headerNew.push(`0000\tdo New^%CSW1UTI("${list}")`);
        headerNew.push(`\tnew ${list}`);
      } else {
        headerNew.push(`\tdo New^%CSW1UTI("${list}")`);
        headerNew.push(`\tnew ${list}`);
      }
    });

    const mac = lines(
      `ROUTINE ${cfg.nome}`,
      `${cfg.nome}\t; ${cfg.mesAno} - ${String(cfg.titulo).toUpperCase()}`,
      `\t;`,
      `\t#include %CSUTICSP`,
      `\t;`,
      ...headerNew,
      `\t;`,
      `\tset %PRG="${cfg.nome}",CT=%index`,
      `\t;`,
      hasCliente
        ? `\tset sc=$$ObterConfLeitor^CCCDBRG001(CE,"Grupo: 1",.CFGCLI)`
        : lines(`\tset sc=$$ValidarExecucaoCSW^CCUTIRG001()`, `\tif sc'=1 do ME^%CSUTICSP(sc) quit`),
      `\t;`,
      `\t; csw:aj:${cfg.ajCols},${cfg.ajRows},${cfg.titulo}`,
      `\tdo AJ^%CSUTIUD(${cfg.ajCols},${cfg.ajRows},"${cfg.titulo}")`,
      `\t;`,
      gen0500(cfg, filterItems),
      genFilters(cfg, filterItems),
      genConsultaGrid(cfg, filterItems),
      gen8000(),
      gen9000(cfg, model, filterItems),
      gen9999(cfg),
      genValcps(filterItems),
      genValidate(filterItems),
      genShow(cfg),
      genTbCellClick(),
      genTags(cfg, model, filterItems),
      ``
    );

    return {
      mac,
      meta: {
        filters: filterItems.length,
        columns: model.columns.length,
        nome: cfg.nome,
      },
    };
  }

  NS.generateMac = generateMac;
})(window.GeracaoRotina);
