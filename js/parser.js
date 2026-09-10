/* Parser da especificação textual → modelo estruturado */

window.GeracaoRotina = window.GeracaoRotina || {};

(function (NS) {
  function slugVar(label, used, preferred) {
    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    let base = String(label)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 10) || "CAMPO";
    if (/^\d/.test(base)) base = "C" + base;
    let name = base;
    let n = 2;
    while (used.has(name)) {
      name = base.slice(0, 8) + n;
      n += 1;
    }
    used.add(name);
    return name;
  }

  function preferredVar(label) {
    const l = label.toLowerCase();
    if (/cliente/.test(l)) return "CODCLI";
    if (/representante/.test(l)) return "CODREP";
    if (/situa/.test(l)) return "SELSIT";
    if (/pedido/.test(l) && !/cliente/.test(l)) return "CODPED";
    return null;
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
      if (/^[-—–]{2,}$/.test(t)) continue;
      if (/^\d+\)\s*rotina/i.test(t)) continue;
      out.push(t.replace(/^[-*•]\s*/, "").replace(/^\d+[).]\s*/, ""));
    }
    return out.filter(Boolean);
  }

  function detectFilter(raw, usedVars) {
    const line = raw.trim();
    const lower = line.toLowerCase();

    // Periodo A -> B
    const periodo = line.match(/^(.+?)\s*(?:->|→|\/)\s*(.+)$/);
    if (periodo && !/multisele/i.test(line)) {
      let labelDe = periodo[1].trim();
      let labelAte = periodo[2].trim();
      let varDe;
      let varAte;

      if (/previs/i.test(line)) {
        varDe = slugVar("PREVIN", usedVars, "PREVIN");
        varAte = slugVar("PREVFN", usedVars, "PREVFN");
        if (!/previs/i.test(labelDe)) labelDe = "Previsão";
        labelAte = "Até";
      } else {
        varDe = slugVar("DATINI", usedVars, "DATINI");
        varAte = slugVar("DATFIM", usedVars, "DATFIM");
        if (/period|emiss|inicial/i.test(labelDe)) labelDe = /emiss/i.test(labelDe) ? "Emissão De" : "Emissão De";
        labelAte = "Até";
      }

      return {
        kind: "periodo",
        labelDe,
        labelAte,
        varDe,
        varAte,
        isDate: true,
        raw: line,
      };
    }

    // Multiseleção
    if (/multisele/i.test(lower)) {
      const name = line
        .replace(/\s*=\s*multisele[cç][aã]o.*/i, "")
        .replace(/\s*multisele[cç][aã]o.*/i, "")
        .replace(/\+/g, "")
        .trim();
      if (/situa/i.test(name)) {
        return {
          kind: "multiselect",
          label: name || "Situação",
          tabVar: slugVar("TABSIT", usedVars, "TABSIT"),
          selVar: slugVar("SELSIT", usedVars, "SELSIT"),
          raw: line,
        };
      }
      const base = slugVar(name, usedVars);
      return {
        kind: "multiselect",
        label: name || "Seleção",
        tabVar: "TAB" + base.replace(/^SEL/, "").slice(0, 8),
        selVar: base.startsWith("SEL") ? base : "SEL" + base.slice(0, 6),
        raw: line,
      };
    }

    // Campo + Display
    const withDisplay = /(.+?)\s*\+\s*display/i.exec(line);
    if (withDisplay) {
      const label = withDisplay[1].trim();
      return {
        kind: "campoDisplay",
        label,
        varName: slugVar(label, usedVars, preferredVar(label)),
        raw: line,
      };
    }

    const label = line.replace(/\+/g, "").trim();
    const isDate = /data|emiss[aã]o|per[ií]odo|previs[aã]o/i.test(label);
    return {
      kind: isDate ? "data" : "campo",
      label,
      varName: slugVar(label, usedVars, preferredVar(label)),
      raw: line,
    };
  }

  function guessColType(name) {
    const n = name.toLowerCase();
    if (/valor|total|bruto|l[ií]quido|comiss[aã]o|perc/.test(n)) return "v2";
    if (/qtde|quantidade|peso|pe[cç]as|saldo/.test(n)) return "v3";
    if ((/emiss[aã]o|previs[aã]o|^data|faturado$/i.test(n)) && !/valor|qtde/.test(n)) return "d";
    if (/^dias$|produp/i.test(n)) return "n";
    return "a";
  }

  function guessColWidth(name, tipo) {
    if (tipo === "d") return 8;
    if (tipo === "v2") return Math.min(14, Math.max(8, Math.ceil(name.length * 0.7)));
    if (tipo === "v3") return 9;
    if (tipo === "n") return 6;
    const len = name.length;
    if (len <= 8) return 10;
    if (len <= 14) return 14;
    if (len <= 22) return 20;
    return 30;
  }

  function parseSpec(text, cfg = {}) {
    const usedVars = new Set(["CT", "%PRG", "sc", "TABGRID", "DADDET", "SN", "COLUNA"]);
    const filtersRaw = sectionLines(text, /^filtros?\s*:?\s*$/i, [/^colunas?\s*:?\s*$/i, /^bot[oõ]es?\s*:?\s*$/i]);
    const columnsRaw = sectionLines(text, /^colunas?\s*:?\s*$/i, [/^bot[oõ]es?\s*:?\s*$/i, /^filtros?\s*:?\s*$/i]);
    const buttonsRaw = sectionLines(text, /^bot[oõ]es?\s*:?\s*$/i, [/^filtros?\s*:?\s*$/i, /^colunas?\s*:?\s*$/i]);

    const filters = filtersRaw.map((raw) => detectFilter(raw, usedVars));

    // Garante tabVar registrado
    for (const f of filters) {
      if (f.kind === "multiselect") {
        usedVars.add(f.tabVar);
        usedVars.add(f.selVar);
      }
    }

    const columns = columnsRaw.map((name, idx) => {
      const tipo = guessColType(name);
      return { name, tipo, width: guessColWidth(name, tipo), index: idx + 1 };
    });

    const buttons = {
      consultar: buttonsRaw.some((b) => /consultar/i.test(b)) || !buttonsRaw.length,
      limpar: buttonsRaw.some((b) => /limpar/i.test(b)) || !buttonsRaw.length,
      extras: buttonsRaw.filter((b) => !/consultar|limpar/i.test(b)),
    };

    const firstLine = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).find(Boolean) || "";
    let titulo = cfg.titulo || "";
    if (!titulo) {
      const m = firstLine.match(/rotina\s+de\s+consulta\s*[-–:]?\s*(.*)$/i);
      titulo = (m && m[1]) || "Consulta";
    }

    return {
      tipo: "consulta",
      titulo,
      filters,
      columns,
      buttons,
    };
  }

  NS.parseSpec = parseSpec;

  NS.EXAMPLE_SPEC = `1) Rotina de consulta

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
Estado
Representante
Emissão
Previsão
Dias
Atraso(+)/Adiantado(-)
Condição de Venda
Faturado
Nota fiscal
Automação
Pedido Cliente
Qtde. Peças
Valor Total Pedido
Qtde. Saldo
Total Bruto em Aberto
Peso em Aberto
Qtde. Faturada
Valor Faturado
Qtde. Cancelada
Valor Cancelado
Aceita Pedido Parcial
Aceita Antecipação
Cliente Agrupador
Produp
Total Líquido em Aberto
Verba em Mercadoria
Verba em Desconto e Duplicata
Etiqueta de Preço
E-Commerce
Caixa Especial
Atendente
Perc. Comissão Atendente

Botões:
Consultar
Limpar
`;
})(window.GeracaoRotina);
