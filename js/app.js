/* UI — Geração de Rotina CSW */

(function () {
  const NS = window.GeracaoRotina;
  const el = {
    nome: document.getElementById("cfgNome"),
    titulo: document.getElementById("cfgTitulo"),
    mesAno: document.getElementById("cfgMesAno"),
    ajCols: document.getElementById("cfgAjCols"),
    ajRows: document.getElementById("cfgAjRows"),
    specIn: document.getElementById("specIn"),
    outMac: document.getElementById("outMac"),
    outMeta: document.getElementById("outMeta"),
    toast: document.getElementById("toast"),
    btnExample: document.getElementById("btnExample"),
    btnGenerate: document.getElementById("btnGenerate"),
    btnCopy: document.getElementById("btnCopy"),
    btnDownload: document.getElementById("btnDownload"),
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.add("hidden"), 1400);
  }

  function readCfg() {
    return {
      nome: (el.nome.value || "ROTINA").trim().toUpperCase().replace(/\W/g, "") || "ROTINA",
      titulo: (el.titulo.value || "Consulta").trim(),
      mesAno: (el.mesAno.value || "01/2026").trim(),
      ajCols: Math.min(108, Math.max(40, Number(el.ajCols.value) || 108)),
      ajRows: Math.min(28, Math.max(10, Number(el.ajRows.value) || 28)),
    };
  }

  function generate() {
    const cfg = readCfg();
    const model = NS.parseSpec(el.specIn.value, { titulo: cfg.titulo });
    if (!cfg.titulo && model.titulo) {
      el.titulo.value = model.titulo;
      cfg.titulo = model.titulo;
    }
    if (!model.filters.length && !model.columns.length) {
      showToast("Especifique Filtros e/ou Colunas");
      return;
    }
    const { mac, meta } = NS.generateMac(cfg, model);
    el.outMac.value = mac;
    el.outMeta.textContent = `${meta.nome} · ${meta.filters} filtro(s) · ${meta.columns} coluna(s)`;
  }

  async function copyOut() {
    const text = el.outMac.value;
    if (!text) {
      showToast("Nada para copiar");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copiado!");
    } catch {
      el.outMac.select();
      document.execCommand("copy");
      showToast("Copiado!");
    }
  }

  function downloadOut() {
    const cfg = readCfg();
    const text = el.outMac.value;
    if (!text) {
      showToast("Gere antes de baixar");
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cfg.nome}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Download iniciado");
  }

  el.btnExample.addEventListener("click", () => {
    el.specIn.value = NS.EXAMPLE_SPEC;
    el.nome.value = "PRLPPV600";
    el.titulo.value = "Consulta de Pedidos";
    el.mesAno.value = "03/2024";
    el.ajCols.value = "108";
    el.ajRows.value = "28";
    generate();
    showToast("Exemplo carregado");
  });
  el.btnGenerate.addEventListener("click", generate);
  el.btnCopy.addEventListener("click", copyOut);
  el.btnDownload.addEventListener("click", downloadOut);

  // Atalho Ctrl+Enter
  el.specIn.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  });
})();
