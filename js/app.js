const STORAGE_KEY = "smartOffersDashboard_v1";

const defaultState = {
  month: "2026-09",
  owner: "",
  updatedAt: "",
  kpis: {
    chgs: null, qaTested: null, qaApproved: null, published: null,
    completed: null, pending: null, chgsOpen: null, express: null,
    impacted: null, qaRejected: null, qaWaiting: null, retests: null
  },
  campaigns: [],
  chgsList: [],
  qaList: [],
  deliveries: [],
  notes: { highlights: "", results: "", attention: "", nextSteps: "" }
};

let state = loadState();
let currentNumberKey = null;
let editingRecord = null;
let campaignChart = null;
let qaChart = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...clone(defaultState),
      ...parsed,
      kpis: { ...clone(defaultState.kpis), ...(parsed.kpis || {}) },
      notes: { ...clone(defaultState.notes), ...(parsed.notes || {}) },
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      chgsList: Array.isArray(parsed.chgsList) ? parsed.chgsList : [],
      qaList: Array.isArray(parsed.qaList) ? parsed.qaList : [],
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : []
    };
  } catch (error) {
    console.error("Não foi possível carregar os dados locais:", error);
    return clone(defaultState);
  }
}

function saveState(showMessage = false) {
  try {
    state.owner = $("#ownerInput").value.trim();
    state.month = $("#monthInput").value || "2026-09";
    state.notes = Object.fromEntries($$("[data-note]").map(el => [el.dataset.note, el.value]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateHeader();
    if (showMessage) showToast("Alterações salvas neste navegador.");
    return true;
  } catch (error) {
    console.error(error);
    showToast("Não foi possível salvar. Verifique o armazenamento do navegador.");
    return false;
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function monthName(value) {
  if (!value) return "Período não selecionado";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function formatDate(value) {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function updateHeader() {
  const period = capitalize(monthName(state.month));
  $("#headingPeriod").textContent = `| ${period}`;
  $("#periodLabel").textContent = period;
  $("#footerPeriod").textContent = period;
  $("#monthInput").value = state.month;
  $("#ownerInput").value = state.owner || "";
  $("#updatedLabel").textContent = state.updatedAt
    ? `Atualizado em ${new Date(state.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
    : "Ainda não atualizado";
  $("#avatarText")?.replaceChildren();
  $("#editHeaderBtn").textContent = state.owner
    ? state.owner.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()
    : "SO";
}

function renderKpis() {
  $$("[data-kpi]").forEach(button => {
    const value = state.kpis[button.dataset.kpi];
    button.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    button.setAttribute("aria-label", `Editar indicador: ${button.dataset.kpi}`);
  });
}

const statusClass = {
  "Publicada": "published", "Aprovada": "approved", "Concluída": "completed",
  "Implantada": "implanted", "Bloqueada": "blocked", "Reprovada": "rejected",
  "Atrasada": "overdue", "Em andamento": "in-progress", "Em QA": "qa",
  "Aguardando aprovação": "waiting", "Aguardando validação": "waiting",
  "Planejada": "", "Aberta": "", "Em correção": "in-progress"
};

function statusPill(status) {
  const className = statusClass[status] || "";
  return `<span class="status-pill ${className}">${escapeHTML(status || "A preencher")}</span>`;
}

function renderCampaigns() {
  const search = ($("#campaignSearch").value || "").trim().toLowerCase();
  const filtered = state.campaigns.filter(item =>
    [item.name, item.type, item.status, item.area, item.objective].join(" ").toLowerCase().includes(search)
  );
  $("#campaignTableBody").innerHTML = filtered.map(item => `
    <tr>
      <td><span class="table-title">${escapeHTML(item.name || "Campanha sem nome")}</span><span class="table-subtitle">${escapeHTML(item.objective || "")}</span></td>
      <td>${escapeHTML(item.type || "—")}</td>
      <td>${statusPill(item.status)}</td>
      <td>${formatDate(item.date || item.dueDate)}</td>
      <td>${escapeHTML(item.area || "—")}</td>
      <td><div class="table-actions"><button class="small-action" data-action="edit" data-kind="campaign" data-id="${item.id}">Editar</button><button class="small-action" data-action="delete" data-kind="campaign" data-id="${item.id}">Excluir</button></div></td>
    </tr>`).join("");
  $("#campaignCount").textContent = `${filtered.length} ${filtered.length === 1 ? "campanha" : "campanhas"}`;
  $("#campaignEmpty").style.display = filtered.length ? "none" : "block";
  renderCharts();
}

function renderChgs() {
  $("#chgTableBody").innerHTML = state.chgsList.map(item => `
    <tr>
      <td><span class="table-title">${escapeHTML(item.code || "—")}</span></td>
      <td>${escapeHTML(item.description || "—")}</td>
      <td>${escapeHTML(item.campaign || "—")}</td>
      <td>${formatDate(item.date)}</td>
      <td>${statusPill(item.status)}</td>
      <td><div class="table-actions"><button class="small-action" data-action="edit" data-kind="chg" data-id="${item.id}">Editar</button><button class="small-action" data-action="delete" data-kind="chg" data-id="${item.id}">Excluir</button></div></td>
    </tr>`).join("");
  $("#chgEmpty").style.display = state.chgsList.length ? "none" : "block";
}

function renderQa() {
  $("#qaTableBody").innerHTML = state.qaList.map(item => `
    <tr>
      <td><span class="table-title">${escapeHTML(item.campaign || "—")}</span></td>
      <td>${formatDate(item.date)}</td>
      <td>${statusPill(item.result)}</td>
      <td>${escapeHTML(item.correction || "—")}</td>
      <td>${escapeHTML(item.notes || "—")}</td>
      <td><div class="table-actions"><button class="small-action" data-action="edit" data-kind="qa" data-id="${item.id}">Editar</button><button class="small-action" data-action="delete" data-kind="qa" data-id="${item.id}">Excluir</button></div></td>
    </tr>`).join("");
  $("#qaEmpty").style.display = state.qaList.length ? "none" : "block";
}

function renderDeliveries() {
  $("#deliveryTableBody").innerHTML = state.deliveries.map(item => `
    <tr>
      <td><span class="table-title">${escapeHTML(item.description || "Entrega sem descrição")}</span></td>
      <td>${escapeHTML(item.category || "—")}</td>
      <td>${formatDate(item.received)}</td>
      <td>${formatDate(item.due)}</td>
      <td>${statusPill(item.status)}</td>
      <td><div class="table-actions"><button class="small-action" data-action="edit" data-kind="delivery" data-id="${item.id}">Editar</button><button class="small-action" data-action="delete" data-kind="delivery" data-id="${item.id}">Excluir</button></div></td>
    </tr>`).join("");
  $("#deliveryEmpty").style.display = state.deliveries.length ? "none" : "block";
}

function renderNotes() {
  $$("[data-note]").forEach(el => { el.value = state.notes[el.dataset.note] || ""; });
}

function renderCharts() {
  const campaignCounts = {};
  state.campaigns.forEach(item => {
    const key = item.status || "Sem status";
    campaignCounts[key] = (campaignCounts[key] || 0) + 1;
  });
  const campaignLabels = Object.keys(campaignCounts);
  $("#campaignChartEmpty").style.display = campaignLabels.length ? "none" : "block";
  if (window.Chart) {
    if (campaignChart) campaignChart.destroy();
    campaignChart = new Chart($("#campaignChart"), {
      type: "doughnut",
      data: { labels: campaignLabels, datasets: [{ data: campaignLabels.map(key => campaignCounts[key]), backgroundColor: ["#660099", "#9b5bc4", "#c6a5dc", "#4c8d74", "#e5a34d", "#d96b79", "#8b7f98"], borderWidth: 2, borderColor: "#fff" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true, padding: 13, font: { size: 10 } } } }, cutout: "64%" }
    });
    const counts = {
      "Aprovada": state.qaList.filter(x => x.result === "Aprovada").length,
      "Reprovada": state.qaList.filter(x => x.result === "Reprovada").length,
      "Aguardando": state.qaList.filter(x => ["Aguardando validação", "Pendente"].includes(x.result)).length
    };
    const qaHasData = state.qaList.length > 0;
    $("#qaChartEmpty").style.display = qaHasData ? "none" : "block";
    if (qaChart) qaChart.destroy();
    qaChart = new Chart($("#qaChart"), {
      type: "bar",
      data: { labels: Object.keys(counts), datasets: [{ label: "Registros", data: Object.values(counts), backgroundColor: ["#18845b", "#bd3545", "#e5a34d"], borderRadius: 6, maxBarThickness: 42 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: "#f0ebf2" } } } }
    });
  } else {
    $("#campaignChartEmpty").textContent = "Biblioteca de gráficos indisponível. Verifique a conexão com a internet.";
    $("#qaChartEmpty").textContent = "Biblioteca de gráficos indisponível. Verifique a conexão com a internet.";
    $("#campaignChartEmpty").style.display = "block";
    $("#qaChartEmpty").style.display = "block";
  }
}

function renderAll() {
  updateHeader();
  renderKpis();
  renderCampaigns();
  renderChgs();
  renderQa();
  renderDeliveries();
  renderNotes();
}

function openNumberDialog(key) {
  currentNumberKey = key;
  const labels = {
    chgs: "CHGs implantadas", qaTested: "Campanhas testadas em QA", qaApproved: "Campanhas aprovadas em QA",
    published: "Campanhas publicadas", completed: "Entregas concluídas", pending: "Pendências em aberto",
    chgsOpen: "CHGs abertas", express: "Ajustes Express", impacted: "Campanhas impactadas",
    qaRejected: "Campanhas reprovadas em QA", qaWaiting: "Aguardando validação", retests: "Retestes realizados"
  };
  $("#numberTitle").textContent = labels[key] || "Editar indicador";
  $("#numberValue").value = state.kpis[key] ?? "";
  $("#numberDialog").showModal();
  $("#numberValue").focus();
}

function field(name, label, type = "text", value = "", options = null, full = false, placeholder = "") {
  const className = full ? "field-group full" : "field-group";
  const safeName = escapeHTML(name);
  let control = "";
  if (options) {
    control = `<select name="${safeName}" ${name === "status" || name === "result" ? "required" : ""}>${options.map(option => `<option value="${escapeHTML(option)}" ${option === value ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}</select>`;
  } else if (type === "textarea") {
    control = `<textarea name="${safeName}" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea>`;
  } else {
    control = `<input name="${safeName}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${type === "date" ? "" : ""} />`;
  }
  return `<label class="${className}"><span>${escapeHTML(label)}</span>${control}</label>`;
}

const recordConfig = {
  campaign: {
    title: "campanha", plural: "Nova campanha", list: "campaigns",
    fields: [
      ["name", "Nome da campanha", "text", null, true],
      ["objective", "Objetivo", "text", null, true],
      ["type", "Tipo de ação", "select", ["Ajuste Express", "Nova campanha", "Parametrização", "Teste", "Publicação", "Manutenção"], false],
      ["status", "Status", "select", ["Planejada", "Em andamento", "Em QA", "Aguardando aprovação", "Concluída", "Publicada", "Bloqueada"], false],
      ["date", "Data de publicação/conclusão", "date", null, false],
      ["dueDate", "Data prevista", "date", null, false],
      ["area", "Área solicitante", "text", null, false],
      ["segment", "Produto ou segmento", "select", ["Pré-Pago", "Controle", "Pós-Pago", "Outro"], false],
      ["notes", "Observações", "textarea", null, true]
    ]
  },
  chg: {
    title: "CHG", plural: "Adicionar CHG", list: "chgsList",
    fields: [
      ["code", "ID da CHG", "text", null, false],
      ["description", "Descrição do ajuste", "text", null, true],
      ["campaign", "Campanha relacionada", "text", null, false],
      ["date", "Data de implantação", "date", null, false],
      ["status", "Status", "select", ["Aberta", "Em andamento", "Implantada", "Bloqueada", "Cancelada"], false],
      ["notes", "Observações", "textarea", null, true]
    ]
  },
  qa: {
    title: "teste de QA", plural: "Adicionar teste de QA", list: "qaList",
    fields: [
      ["campaign", "Nome da campanha", "text", null, true],
      ["date", "Data do teste", "date", null, false],
      ["result", "Resultado", "select", ["Aprovada", "Reprovada", "Aguardando validação", "Pendente"], false],
      ["correction", "Status da correção", "select", ["Não se aplica", "Pendente", "Em correção", "Corrigido", "Reteste necessário"], false],
      ["notes", "Observações", "textarea", null, true]
    ]
  },
  delivery: {
    title: "entrega", plural: "Nova entrega", list: "deliveries",
    fields: [
      ["description", "Descrição da entrega", "text", null, true],
      ["category", "Categoria", "select", ["Campanha", "CHG", "QA", "Parametrização", "Análise", "Documentação", "Outro"], false],
      ["received", "Data de recebimento", "date", null, false],
      ["due", "Conclusão prevista", "date", null, false],
      ["status", "Status", "select", ["Planejada", "Em andamento", "Concluída", "Atrasada", "Bloqueada"], false],
      ["notes", "Observações", "textarea", null, true]
    ]
  }
};

function openRecordDialog(kind, record = null) {
  editingRecord = { kind, id: record?.id || null };
  const config = recordConfig[kind];
  $("#dialogEyebrow").textContent = record ? "EDITAR REGISTRO" : "NOVO REGISTRO";
  $("#dialogTitle").textContent = record ? `Editar ${config.title}` : config.plural;
  $("#dialogFields").innerHTML = config.fields.map(([name, label, type, options, full]) => {
    const value = record?.[name] ?? (type === "select" ? options[0] : "");
    return field(name, label, type === "select" ? "text" : type, value, options, full, `Informe ${label.toLowerCase()}`);
  }).join("");
  $("#recordDialog").showModal();
}

function closeRecordDialog() {
  $("#recordDialog").close();
  editingRecord = null;
}

function handleRecordSubmit(event) {
  event.preventDefault();
  if (!editingRecord) return;
  const { kind, id } = editingRecord;
  const config = recordConfig[kind];
  const formData = new FormData($("#recordForm"));
  const record = Object.fromEntries(formData.entries());
  record.id = id || `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const list = state[config.list];
  const index = list.findIndex(item => item.id === record.id);
  if (index >= 0) list[index] = { ...list[index], ...record };
  else list.unshift(record);
  closeRecordDialog();
  renderAll();
  saveState(true);
}

function deleteRecord(kind, id) {
  const config = recordConfig[kind];
  const item = state[config.list].find(record => record.id === id);
  if (!item) return;
  const label = item.name || item.code || item.campaign || item.description || config.title;
  if (!confirm(`Deseja excluir "${label}"? Essa ação não pode ser desfeita.`)) return;
  state[config.list] = state[config.list].filter(record => record.id !== id);
  renderAll();
  saveState(true);
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, kind, id } = button.dataset;
  const config = recordConfig[kind];
  if (!config) return;
  if (action === "delete") return deleteRecord(kind, id);
  const record = state[config.list].find(item => item.id === id);
  if (record) openRecordDialog(kind, record);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smart-offers-${state.month || "dados"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Arquivo JSON exportado.");
}

function setupEvents() {
  document.addEventListener("click", event => {
    const kpiButton = event.target.closest("[data-kpi]");
    if (kpiButton) openNumberDialog(kpiButton.dataset.kpi);
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleTableAction(event);
  });

  $("#numberForm").addEventListener("submit", event => {
    event.preventDefault();
    const raw = $("#numberValue").value;
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      showToast("Informe um número inteiro igual ou maior que zero.");
      return;
    }
    state.kpis[currentNumberKey] = value;
    $("#numberDialog").close();
    renderKpis();
    saveState(true);
  });
  $("#closeNumberBtn").addEventListener("click", () => $("#numberDialog").close());
  $("#cancelNumberBtn").addEventListener("click", () => $("#numberDialog").close());

  $("#recordForm").addEventListener("submit", handleRecordSubmit);
  $("#closeDialogBtn").addEventListener("click", closeRecordDialog);
  $("#cancelDialogBtn").addEventListener("click", closeRecordDialog);

  $("#addCampaignBtn").addEventListener("click", () => openRecordDialog("campaign"));
  $("#addChgBtn").addEventListener("click", () => openRecordDialog("chg"));
  $("#addQaBtn").addEventListener("click", () => openRecordDialog("qa"));
  $("#addDeliveryBtn").addEventListener("click", () => openRecordDialog("delivery"));
  $("#campaignSearch").addEventListener("input", renderCampaigns);
  $("#saveBtn").addEventListener("click", () => saveState(true));
  $("#exportBtn").addEventListener("click", exportData);

  $("#monthInput").addEventListener("change", () => {
    state.month = $("#monthInput").value || "2026-09";
    updateHeader();
    saveState(true);
  });
  $("#ownerInput").addEventListener("change", () => {
    state.owner = $("#ownerInput").value.trim();
    updateHeader();
    saveState(true);
  });
  $("#editHeaderBtn").addEventListener("click", () => {
    $("#ownerInput").focus();
    $("#ownerInput").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $$("[data-note]").forEach(el => el.addEventListener("change", () => {
    state.notes[el.dataset.note] = el.value;
    saveState(false);
    showToast("Texto atualizado.");
  }));

  $$("a.nav-link").forEach(link => link.addEventListener("click", () => {
    $$(".nav-link").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  }));

  [$("#recordDialog"), $("#numberDialog")].forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  setupImport();
  renderAll();
});


/* =========================================================
   IMPORTAÇÃO / MODELO EXCEL
   Abas: Resumo, Campanhas, CHGs, QA, Entregas
   Os cabeçalhos das listas vêm de recordConfig, então
   formulário e planilha ficam sempre sincronizados.
   ========================================================= */
const XLSX_SHEETS = { campaign: "Campanhas", chg: "CHGs", qa: "QA", delivery: "Entregas" };

const XLSX_KPI_LABELS = {
  chgs: "CHGs implantadas", qaTested: "Campanhas testadas em QA", qaApproved: "Campanhas aprovadas em QA",
  published: "Campanhas publicadas", completed: "Entregas concluídas", pending: "Pendências em aberto",
  chgsOpen: "CHGs abertas", express: "Ajustes Express", impacted: "Campanhas impactadas",
  qaRejected: "Campanhas reprovadas em QA", qaWaiting: "Aguardando validação", retests: "Retestes realizados"
};
const XLSX_NOTE_LABELS = {
  highlights: "Principais entregas", results: "Resultados e melhorias",
  attention: "Pontos de atenção", nextSteps: "Próximos passos"
};
const XLSX_MONTH_LABEL = "Mês de referência (AAAA-MM)";
const XLSX_OWNER_LABEL = "Responsável pela atualização";

const normKey = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

function pad2(n) { return String(n).padStart(2, "0"); }

function excelSerialToParts(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  return d ? { y: d.y, m: d.m, d: d.d } : null;
}

// Converte célula em "AAAA-MM-DD" (aceita data do Excel, dd/mm/aaaa e aaaa-mm-dd)
function parseDateCell(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (value instanceof Date) return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  if (typeof value === "number") {
    const p = excelSerialToParts(value);
    return p ? `${p.y}-${pad2(p.m)}-${pad2(p.d)}` : null;
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return null; // inválida
}

// Converte célula em "AAAA-MM"
function parseMonthCell(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number") {
    const p = excelSerialToParts(value);
    return p ? `${p.y}-${pad2(p.m)}` : null;
  }
  if (value instanceof Date) return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}`;
  m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${pad2(m[2])}`;
  m = text.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[2]}-${pad2(m[1])}`;
  return null;
}

function findSheet(workbook, name) {
  const found = workbook.SheetNames.find(n => normKey(n) === normKey(name));
  return found ? workbook.Sheets[found] : null;
}

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: false });
}

function isExampleRow(row) {
  return normKey(row[0]).startsWith("(exemplo");
}

function parseListSheet(sheet, kind, warnings) {
  const config = recordConfig[kind];
  const sheetName = XLSX_SHEETS[kind];
  const rows = sheetToRows(sheet);
  const wanted = config.fields.map(f => normKey(f[1]));

  // localiza a linha de cabeçalho (até a 10ª linha)
  let headerIndex = rows.slice(0, 10).findIndex(r => r.some(c => wanted.includes(normKey(c))));
  if (headerIndex < 0) {
    warnings.push(`Aba "${sheetName}": cabeçalhos não encontrados. Use o modelo oficial.`);
    return null;
  }
  const header = rows[headerIndex].map(normKey);
  const colIndex = {};
  config.fields.forEach(([name, label]) => { colIndex[name] = header.indexOf(normKey(label)); });
  config.fields.forEach(([name, label]) => {
    if (colIndex[name] < 0) warnings.push(`Aba "${sheetName}": coluna "${label}" não encontrada (ficará vazia).`);
  });

  const records = [];
  rows.slice(headerIndex + 1).forEach((row, i) => {
    if (isExampleRow(row)) return;
    const line = headerIndex + i + 2;
    const record = {};
    let hasData = false;
    config.fields.forEach(([name, label, type, options]) => {
      const raw = colIndex[name] >= 0 ? row[colIndex[name]] : "";
      let value = "";
      if (raw !== "" && raw !== null && raw !== undefined) {
        if (type === "date") {
          const iso = parseDateCell(raw);
          if (iso === null) warnings.push(`${sheetName}, linha ${line}: data inválida em "${label}" (${raw}). Use dd/mm/aaaa.`);
          else value = iso;
        } else if (type === "select") {
          const match = options.find(o => normKey(o) === normKey(raw));
          if (match) value = match;
          else {
            value = String(raw).trim();
            warnings.push(`${sheetName}, linha ${line}: valor "${value}" não está na lista de "${label}".`);
          }
        } else {
          value = String(raw).trim();
        }
      }
      if (value !== "") hasData = true;
      record[name] = value;
    });
    if (!hasData) return;
    record.id = `${kind}_${Date.now()}_${records.length}_${Math.random().toString(36).slice(2, 6)}`;
    records.push(record);
  });
  return records;
}

function parseSummarySheet(sheet, warnings) {
  const rows = sheetToRows(sheet);
  const map = new Map();
  rows.forEach(row => { if (row[0] !== "" && !map.has(normKey(row[0]))) map.set(normKey(row[0]), row[1]); });
  const result = { kpis: {}, notes: {} };

  const month = map.get(normKey(XLSX_MONTH_LABEL));
  if (month !== undefined && month !== "") {
    const parsed = parseMonthCell(month);
    if (parsed) result.month = parsed;
    else warnings.push(`Resumo: mês inválido (${month}). Use o formato AAAA-MM, por exemplo 2026-09.`);
  }
  const owner = map.get(normKey(XLSX_OWNER_LABEL));
  if (owner !== undefined && String(owner).trim() !== "") result.owner = String(owner).trim();

  Object.entries(XLSX_KPI_LABELS).forEach(([key, label]) => {
    const raw = map.get(normKey(label));
    if (raw === undefined || raw === "") return;
    const num = Number(String(raw).replace(",", "."));
    if (Number.isInteger(num) && num >= 0) result.kpis[key] = num;
    else warnings.push(`Resumo: "${label}" precisa ser um número inteiro ≥ 0 (recebido: ${raw}).`);
  });
  Object.entries(XLSX_NOTE_LABELS).forEach(([key, label]) => {
    const raw = map.get(normKey(label));
    if (raw !== undefined && String(raw).trim() !== "") result.notes[key] = String(raw).trim();
  });
  return result;
}

function importWorkbook(workbook) {
  const warnings = [];
  const found = {};
  const summarySheet = findSheet(workbook, "Resumo");
  const summary = summarySheet ? parseSummarySheet(summarySheet, warnings) : null;

  Object.entries(XLSX_SHEETS).forEach(([kind, name]) => {
    const sheet = findSheet(workbook, name);
    if (sheet) found[kind] = parseListSheet(sheet, kind, warnings);
  });

  const kinds = Object.keys(found).filter(k => found[k] !== null);
  if (!summary && !kinds.length) {
    alert("Nenhuma aba reconhecida. O arquivo precisa ter as abas: Resumo, Campanhas, CHGs, QA e Entregas.\n\nUse o botão \"Baixar modelo Excel\".");
    return;
  }

  const lines = kinds.map(k => `• ${XLSX_SHEETS[k]}: ${found[k].length} registro(s)`);
  if (summary) lines.unshift("• Resumo: indicadores, textos, mês e responsável");
  const message = `Importar esta planilha?\n\n${lines.join("\n")}\n\nAs listas das abas encontradas serão SUBSTITUÍDAS pelos dados da planilha. Abas ausentes não são alteradas.`;
  if (!confirm(message)) return;

  kinds.forEach(k => { state[recordConfig[k].list] = found[k]; });
  if (summary) {
    if (summary.month) state.month = summary.month;
    if (summary.owner) state.owner = summary.owner;
    Object.assign(state.kpis, summary.kpis);
    Object.assign(state.notes, summary.notes);
  }
  renderAll();
  saveState(false);
  showToast(warnings.length ? `Importado com ${warnings.length} aviso(s).` : "Planilha importada com sucesso.");
  if (warnings.length) {
    const shown = warnings.slice(0, 15).join("\n");
    const extra = warnings.length > 15 ? `\n… e mais ${warnings.length - 15} aviso(s).` : "";
    setTimeout(() => alert(`Importação concluída com avisos:\n\n${shown}${extra}`), 200);
  }
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!window.XLSX) {
    showToast("Biblioteca de Excel indisponível. Verifique a conexão com a internet.");
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    importWorkbook(workbook);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível ler o arquivo. Use um .xlsx válido.");
  }
}

function downloadTemplate() {
  if (!window.XLSX) {
    showToast("Biblioteca de Excel indisponível. Verifique a conexão com a internet.");
    return;
  }
  const wb = XLSX.utils.book_new();
  const add = (name, aoa, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Instruções", [
    ["Modelo de importação – Smart Offers"],
    [""],
    ["1. Preencha as abas Resumo, Campanhas, CHGs, QA e Entregas."],
    ["2. Não altere os nomes das abas nem os cabeçalhos."],
    ["3. Datas no formato dd/mm/aaaa. Colunas de status/tipo: use os valores da lista."],
    ["4. Linhas que começam com (EXEMPLO) são ignoradas na importação."],
    ["5. No painel: Importar planilha Excel. As listas das abas preenchidas substituem as atuais."]
  ], [110]);
  const summary = [["Campo", "Valor"], [XLSX_MONTH_LABEL, state.month || "2026-09"], [XLSX_OWNER_LABEL, ""]];
  Object.values(XLSX_KPI_LABELS).forEach(l => summary.push([l, ""]));
  Object.values(XLSX_NOTE_LABELS).forEach(l => summary.push([l, ""]));
  add("Resumo", summary, [34, 70]);
  Object.entries(XLSX_SHEETS).forEach(([kind, name]) => {
    const fields = recordConfig[kind].fields;
    const example = fields.map(([n, , type, options], i) => i === 0 ? "(EXEMPLO) apague ou deixe" : type === "select" ? options[0] : type === "date" ? "15/09/2026" : "");
    add(name, [fields.map(f => f[1]), example], fields.map(f => Math.max(18, f[1].length + 4)));
  });
  XLSX.writeFile(wb, "modelo-importacao-smart-offers.xlsx");
}

function setupImport() {
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", handleImportFile);
  $("#templateBtn").addEventListener("click", downloadTemplate);
}
