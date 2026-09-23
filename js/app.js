/* UI — Geração de Rotina CSW */

(function () {
  const NS = window.GeracaoRotina;
  const $ = (id) => document.getElementById(id);
  const el = {
    nome: $("cfgNome"),
    autor: $("cfgAutor"),
    titulo: $("cfgTitulo"),
    ajCols: $("cfgAjCols"),
    ajRows: $("cfgAjRows"),
    trava: $("cfgTrava"),
    specIn: $("specIn"),
    outMac: $("outMac"),
    outMeta: $("outMeta"),
    outAvisos: $("outAvisos"),
    help: $("help"),
    toast: $("toast"),
  };

  const state = { tab: "tela", result: null, nome: "" };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.add("hidden"), 1400);
  }

  function mesAnoAtual() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function readCfg() {
    return {
      nome: (el.nome.value || "").trim().toUpperCase().replace(/[^%A-Z0-9]/g, ""),
      autor: (el.autor.value || "").trim().toUpperCase(),
      titulo: (el.titulo.value || "Consulta").trim(),
      mesAno: mesAnoAtual(),
      ajCols: Math.min(108, Math.max(40, Number(el.ajCols.value) || 108)),
      ajRows: Math.min(28, Math.max(10, Number(el.ajRows.value) || 28)),
      trava: el.trava.value,
    };
  }

  function render() {
    const r = state.result;
    el.outMac.value = r ? (state.tab === "tela" ? r.tela : r.rg) : "";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === state.tab));
  }

  function generate() {
    const cfg = readCfg();
    if (!cfg.nome) {
      showToast("Informe o código da rotina");
      el.nome.focus();
      return;
    }
    const model = NS.parseSpec(el.specIn.value, { titulo: cfg.titulo });
    if (!model.filters.length && !model.columns.length) {
      showToast("Especifique Filtros e/ou Colunas");
      return;
    }
    state.result = NS.generate(cfg, model);
    state.nome = cfg.nome;
    const m = state.result.meta;
    el.outMeta.textContent = `${m.nome} · ${m.filters} filtro(s) · ${m.columns} coluna(s) · ${m.botoes} botão(ões) extra`;

    el.outAvisos.innerHTML = "";
    for (const a of state.result.avisos) {
      const li = document.createElement("li");
      li.textContent = a;
      el.outAvisos.appendChild(li);
    }
    el.outAvisos.classList.toggle("hidden", !state.result.avisos.length);
    render();
  }

  async function copyOut() {
    const text = el.outMac.value;
    if (!text) return showToast("Nada para copiar");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      el.outMac.select();
      document.execCommand("copy");
    }
    showToast("Copiado!");
  }

  function baixar(nomeArquivo, texto) {
    // Fontes do ERP são CRLF
    const blob = new Blob([texto.replace(/\r?\n/g, "\r\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function downloadOut() {
    const r = state.result;
    if (!r) return showToast("Gere antes de baixar");
    baixar(`${state.nome}.mac`, r.tela);
    setTimeout(() => baixar(`${state.nome}RG.mac`, r.rg), 300);
    showToast("Download iniciado");
  }

  $("btnExample").addEventListener("click", () => {
    el.specIn.value = NS.EXAMPLE_SPEC;
    el.nome.value = "CCXX600";
    el.titulo.value = "Consulta de Pedidos";
    generate();
    showToast("Exemplo carregado");
  });
  $("btnGenerate").addEventListener("click", generate);
  $("btnCopy").addEventListener("click", copyOut);
  $("btnDownload").addEventListener("click", downloadOut);
  $("btnHelp").addEventListener("click", () => el.help.classList.toggle("hidden"));
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      state.tab = t.dataset.tab;
      render();
    })
  );

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  });
})();
