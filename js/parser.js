/* Parser da especificação textual → modelo estruturado */

window.GeracaoRotina = window.GeracaoRotina || {};

(function (NS) {
  function semAcento(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function palavras(label) {
    return semAcento(label)
      .replace(/[^A-Za-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && !/^(de|da|do|das|dos|e|em|a|o|para|por)$/i.test(w));
  }

  // "Situação do Pedido" → "situacaoPedido" (parâmetro/variável na RG)
  function camel(label, prefixo) {
    const ws = palavras(label).map((w) => w.toLowerCase());
    if (prefixo) ws.unshift(prefixo);
    if (!ws.length) return "campo";
    let out = ws[0] + ws.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    if (/^\d/.test(out)) out = "c" + out;
    return out;
  }

  // "Situação do Pedido" → "SituacaoPedido" (sufixo de label de regra)
  function pascal(label) {
    const c = camel(label);
    return c[0].toUpperCase() + c.slice(1);
  }

  // Variável de tela: maiúscula, 6 caracteres
  function varTela(label, used, prefixo) {
    const ws = palavras(label).map((w) => w.toUpperCase());
    let base;
    if (prefixo) base = prefixo + (ws[0] || "CPO").slice(0, 6 - prefixo.length);
    else if (ws.length >= 2) base = ws[0].slice(0, 3) + ws[1].slice(0, 3);
    else base = (ws[0] || "CAMPO").slice(0, 6);
    if (/^\d/.test(base)) base = "C" + base.slice(0, 5);
    let name = base;
    let n = 2;
    while (used.has(name)) {
      name = base.slice(0, 5) + n;
      n += 1;
    }
    used.add(name);
    return name;
  }

  function sectionLines(text, startRe, endRes) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (startRe.test(lines[i].trim())) {
        start = i + 1;
        break;
      }
    }
    if (start < 0) return [];
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (endRes.some((re) => re.test(t))) break;
      if (/^[-—–]{2,}$/.test(t) || /^#/.test(t)) continue;
      out.push(t.replace(/^[-•]\s+/, "").replace(/^\d+[).]\s+/, ""));
    }
    return out.filter(Boolean);
  }

  const RE_DATA = /\b(data|emiss[aã]o|per[ií]odo|previs[aã]o|vencimento|entrega)\b/i;

  function detectFilter(raw, used) {
    let line = raw.trim();
    const avisos = [];

    // Obrigatório: "*" no fim
    let obrigatorio = false;
    if (/\*\s*$/.test(line)) {
      obrigatorio = true;
      line = line.replace(/\s*\*\s*$/, "");
    }

    // F7=LABEL^ROTINA
    let f7 = "";
    line = line
      .replace(/\s*\bF7\s*=\s*([%A-Za-z0-9]+\^[%A-Za-z0-9]+(?:\([^)]*\))?)/i, (_, v) => {
        f7 = v;
        return "";
      })
      .trim();

    // Período: "A -> B"
    const periodo = line.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
    if (periodo) {
      const labelDe = periodo[1].trim();
      const labelFim = periodo[2].trim();
      const pref = (palavras(labelDe)[0] || "DAT").toUpperCase().slice(0, 3);
      return {
        kind: "periodo",
        label: labelDe.replace(/\s+inicial$/i, "") || labelDe,
        labelAte: "Até",
        labelFim,
        varDe: varTela(pref + "INI", used, pref + "INI"),
        varAte: varTela(pref + "FIM", used, pref + "FIM"),
        paramDe: camel(labelDe),
        paramAte: camel(labelFim),
        obrigatorio,
        raw,
        avisos,
      };
    }

    // Multiseleção
    if (/multisele[cç][aã]o/i.test(line)) {
      const ops = line.match(/multisele[cç][aã]o\s*\((.*)\)\s*$/i);
      const label = line.replace(/\s*=?\s*multisele[cç][aã]o.*$/i, "").replace(/\+/g, "").trim() || "Seleção";
      return {
        kind: "multiselect",
        label,
        tabVar: varTela(label, used, "TAB"),
        selVar: varTela(label, used, "SEL"),
        param: camel(label, "sel"),
        regraTab: "ObterTab" + pascal(label),
        opcoes: ops ? ops[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
        obrigatorio,
        raw,
        avisos,
      };
    }

    // Combo: "Tipo = combo (A, B, C)"
    const combo = line.match(/^(.+?)\s*=\s*combo\s*(?:\((.*)\))?\s*$/i);
    if (combo) {
      const label = combo[1].trim();
      const opcoes = (combo[2] || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (!opcoes.length) avisos.push(`Combo "${label}" sem opções — use "= combo (A, B, C)".`);
      return {
        kind: "combo",
        label,
        varName: varTela(label, used),
        tabVar: varTela(label, used, "TAB"),
        param: camel(label),
        regraTab: "ObterTab" + pascal(label),
        opcoes,
        obrigatorio,
        raw,
        avisos,
      };
    }

    // Sim/Não (radio)
    const simnao = line.match(/^(.+?)\s*=\s*(?:sim\s*\/\s*n[aã]o|radio)\s*$/i);
    if (simnao) {
      const label = simnao[1].trim();
      return {
        kind: "simnao",
        label,
        varName: varTela(label, used),
        param: camel(label),
        obrigatorio,
        raw,
        avisos,
      };
    }

    // Campo + Display
    const withDisplay = /^(.+?)\s*\+\s*display\s*$/i.exec(line);
    if (withDisplay) {
      const label = withDisplay[1].trim();
      return {
        kind: "display",
        label,
        varName: varTela(label, used, "COD"),
        descVar: varTela(label, used, "DES"),
        param: camel(label, "cod"),
        regraDesc: "ObterDescricao" + pascal(label),
        f7,
        obrigatorio,
        raw,
        avisos,
      };
    }

    // Campo com tipo explícito: "Pedido : inteiro 8"
    let label = line;
    let tipo;
    let tam = null;
    const tipado = line.match(/^(.+?)\s*:\s*(texto|inteiro|n[uú]mero|data)\s*(\d+)?\s*$/i);
    if (tipado) {
      label = tipado[1].trim();
      tipo = semAcento(tipado[2].toLowerCase()).replace("numero", "inteiro");
      tam = tipado[3] ? Number(tipado[3]) : null;
    } else {
      label = line.replace(/\+/g, "").trim();
      tipo = RE_DATA.test(label) ? "data" : "texto";
    }

    return {
      kind: tipo,
      label,
      varName: varTela(label, used),
      param: camel(label),
      tam,
      f7,
      obrigatorio,
      raw,
      avisos,
    };
  }

  function guessColType(name) {
    const n = name.toLowerCase();
    if (/perc|valor|total|bruto|l[ií]quido|comiss[aã]o|pre[cç]o|verba/.test(n)) return "v2";
    if (/qtde|quantidade|peso|pe[cç]as|saldo/.test(n)) return "v3";
    if (/emiss[aã]o|previs[aã]o|^data|vencimento/.test(n)) return "d";
    if (/^dias$|^c[oó]d(igo)?\b|^seq/.test(n)) return "n";
    return "a";
  }

  function guessColWidth(name, tipo) {
    if (tipo === "d") return 8;
    if (/^v\d$/.test(tipo)) return Math.min(14, Math.max(9, Math.ceil(name.length * 0.6)));
    if (tipo === "n") return 6;
    const len = name.length;
    if (len <= 8) return 10;
    if (len <= 14) return 14;
    if (len <= 22) return 20;
    return 30;
  }

  // "Valor Total : v2 : 12" | "Valor Total : v2" | "Valor Total : 12" | "Valor Total"
  function parseColumn(raw, idx) {
    const parts = raw.split(":").map((s) => s.trim());
    const name = parts[0];
    let tipo = null;
    let width = null;
    for (const p of parts.slice(1)) {
      if (/^\d+$/.test(p)) width = Number(p);
      else if (/^(a|n|d|v\d?|f\d)$/i.test(p)) tipo = p.toLowerCase();
    }
    tipo = tipo || guessColType(name);
    width = width || guessColWidth(name, tipo);
    return { name, tipo, width, index: idx + 1, param: camel(name.replace(/!/g, " ")) };
  }

  function uniqueNamer(reserved) {
    const used = new Set(reserved);
    return (p) => {
      let name = p;
      let n = 2;
      while (used.has(name)) name = p + n++;
      used.add(name);
      return name;
    };
  }

  function parseSpec(text, cfg = {}) {
    const used = new Set(["CT", "%PRG", "%TR", "TABGRID", "SN", "HABBOT", "CE"]);
    const reSec = [/^filtros?\s*:?\s*$/i, /^colunas?\s*:?\s*$/i, /^bot[oõ]es?\s*:?\s*$/i];
    const filtersRaw = sectionLines(text, reSec[0], [reSec[1], reSec[2]]);
    const columnsRaw = sectionLines(text, reSec[1], [reSec[2], reSec[0]]);
    const buttonsRaw = sectionLines(text, reSec[2], [reSec[0], reSec[1]]);

    const filters = filtersRaw.map((raw) => detectFilter(raw, used));

    const uniqParam = uniqueNamer(["term", "rotina", "codEmpresa", "sc"]);
    for (const f of filters) {
      if (f.kind === "periodo") {
        f.paramDe = uniqParam(f.paramDe);
        f.paramAte = uniqParam(f.paramAte);
      } else f.param = uniqParam(f.param);
    }

    const columns = columnsRaw.map(parseColumn);
    const uniqCol = uniqueNamer(["term", "rotina", "codEmpresa", "chave", "dados", "display", "detalha", "linha", "sc"]);
    for (const c of columns) c.param = uniqCol(c.param);

    const extras = buttonsRaw.filter((b) => !/^(consultar|limpar)$/i.test(b.trim()));

    return {
      tipo: "consulta",
      titulo: cfg.titulo || "Consulta",
      filters,
      columns,
      buttons: { extras },
    };
  }

  NS.parseSpec = parseSpec;
  NS.util = { camel, pascal, semAcento };

  NS.EXAMPLE_SPEC = `Filtros:
Cliente + Display
Representante + Display
Situação do Pedido = multiseleção
Emissão Inicial -> Emissão Final *
Previsão Inicial -> Previsão Final
Tipo de Venda = combo (Normal, Bonificação, Troca)
Somente em Atraso = sim/não

Colunas:
Pedido : n : 8
Situação
Cliente
Representante
Emissão
Previsão
Dias : n
Condição de Venda
Qtde. Peças
Valor Total ! Pedido
Qtde. Saldo
Total Bruto ! em Aberto
Perc. Comissão

Botões:
Consultar
Limpar
Imprimir
Exportar
`;
})(window.GeracaoRotina);
