const state = {
  publicData: null,
  participantSession: localStorage.getItem("bolaoParticipantId") || "",
  adminToken: localStorage.getItem("bolaoAdminToken") || "",
  adminData: null
};

const TEAM_FLAGS = {
  "africa do sul": "🇿🇦",
  alemanha: "🇩🇪",
  "arabia saudita": "🇸🇦",
  argelia: "🇩🇿",
  argentina: "🇦🇷",
  australia: "🇦🇺",
  austria: "🇦🇹",
  belgica: "🇧🇪",
  bosnia: "🇧🇦",
  brasil: "🇧🇷",
  "cabo verde": "🇨🇻",
  canada: "🇨🇦",
  catar: "🇶🇦",
  colombia: "🇨🇴",
  "coreia do sul": "🇰🇷",
  "costa do marfim": "🇨🇮",
  croacia: "🇭🇷",
  curacao: "🇨🇼",
  egito: "🇪🇬",
  equador: "🇪🇨",
  escocia: "🏴",
  espanha: "🇪🇸",
  "estados unidos": "🇺🇸",
  franca: "🇫🇷",
  frança: "🇫🇷",
  gana: "🇬🇭",
  haiti: "🇭🇹",
  holanda: "🇳🇱",
  inglaterra: "🏴",
  ira: "🇮🇷",
  iraque: "🇮🇶",
  japao: "🇯🇵",
  japão: "🇯🇵",
  jordania: "🇯🇴",
  marrocos: "🇲🇦",
  mexico: "🇲🇽",
  méxico: "🇲🇽",
  noruega: "🇳🇴",
  "nova zelandia": "🇳🇿",
  panama: "🇵🇦",
  paraguai: "🇵🇾",
  portugal: "🇵🇹",
  "rd congo": "🇨🇩",
  "republica tcheca": "🇨🇿",
  senegal: "🇸🇳",
  suecia: "🇸🇪",
  suica: "🇨🇭",
  suiça: "🇨🇭",
  tunisia: "🇹🇳",
  turquia: "🇹🇷",
  uruguai: "🇺🇾",
  uzbequistao: "🇺🇿"
};

const dom = {
  nav: document.querySelector("#nav"),
  views: document.querySelectorAll(".view"),
  statusText: document.querySelector("#statusText"),
  shareUrl: document.querySelector("#shareUrl"),
  shareMessage: document.querySelector("#shareMessage"),
  copyLink: document.querySelector("#copyLink"),
  registerForm: document.querySelector("#registerForm"),
  participantName: document.querySelector("#participantName"),
  participantPhone: document.querySelector("#participantPhone"),
  registrationResult: document.querySelector("#registrationResult"),
  loadParticipantForm: document.querySelector("#loadParticipantForm"),
  participantIdInput: document.querySelector("#participantIdInput"),
  participantBox: document.querySelector("#participantBox"),
  predictionsForm: document.querySelector("#predictionsForm"),
  matchesList: document.querySelector("#matchesList"),
  savePredictions: document.querySelector("#savePredictions"),
  searchPhoneForm: document.querySelector("#searchPhoneForm"),
  searchPhoneInput: document.querySelector("#searchPhoneInput"),
  searchPhoneResult: document.querySelector("#searchPhoneResult"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminUsername: document.querySelector("#adminUsername"),
  adminPassword: document.querySelector("#adminPassword"),
  adminPanel: document.querySelector("#adminPanel"),
  adminCopyLink: document.querySelector("#adminCopyLink"),
  adminCopyWhatsapp: document.querySelector("#adminCopyWhatsapp"),
  deadlineAt: document.querySelector("#deadlineAt"),
  locked: document.querySelector("#locked"),
  saveSettings: document.querySelector("#saveSettings"),
  participantsTable: document.querySelector("#participantsTable"),
  editParticipantPanel: document.querySelector("#editParticipantPanel"),
  editName: document.querySelector("#editName"),
  editPhone: document.querySelector("#editPhone"),
  saveEditParticipant: document.querySelector("#saveEditParticipant"),
  cancelEditParticipant: document.querySelector("#cancelEditParticipant"),
  resultsList: document.querySelector("#resultsList"),
  saveResults: document.querySelector("#saveResults"),
  importJson: document.querySelector("#importJson"),
  importGames: document.querySelector("#importGames"),
  loadExample: document.querySelector("#loadExample"),
  rankingTable: document.querySelector("#rankingTable"),
  publicRanking: document.querySelector("#publicRanking"),
  exportPdf: document.querySelector("#exportPdf"),
  exportCsv: document.querySelector("#exportCsv"),
  toast: document.querySelector("#toast")
};

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "").slice(0, 24);
}

function matchOutcome(scoreA, scoreB) {
  if (scoreA === scoreB) return "D";
  return scoreA > scoreB ? "A" : "B";
}

function normalizeTeamName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function teamFlag(team) {
  const raw = String(team || "").toLowerCase().trim();
  return TEAM_FLAGS[raw] || TEAM_FLAGS[normalizeTeamName(team)] || "🏳️";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.admin) headers.Authorization = `Bearer ${state.adminToken}`;
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload.error || "Erro ao processar a solicitacao.");
  return payload;
}

async function init() {
  bindEvents();
  await loadPublicData();
  await renderRanking();
  const urlId = new URLSearchParams(location.search).get("id");
  if (urlId) {
    await loadParticipant(urlId, true);
  } else if (state.participantSession) {
    await loadParticipant(state.participantSession, false);
  }
  if (state.adminToken) await loadAdminData(false);
}

function bindEvents() {
  dom.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) showView(button.dataset.view);
  });
  dom.copyLink.addEventListener("click", copyShareMessage);
  dom.registerForm.addEventListener("submit", registerParticipant);
  dom.loadParticipantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadParticipant(dom.participantIdInput.value.trim(), true);
  });
  dom.searchPhoneForm.addEventListener("submit", searchByPhone);
  dom.savePredictions.addEventListener("click", savePredictions);
  dom.adminLoginForm.addEventListener("submit", loginAdmin);
  dom.adminCopyLink.addEventListener("click", adminCopyPublicLink);
  dom.adminCopyWhatsapp.addEventListener("click", adminCopyWhatsappMsg);
  dom.saveSettings.addEventListener("click", saveSettings);
  dom.saveResults.addEventListener("click", saveResults);
  dom.importGames.addEventListener("click", importGames);
  dom.loadExample.addEventListener("click", loadExampleJson);
  dom.exportPdf.addEventListener("click", () => downloadExport("/api/admin/exports/ranking.pdf", "ranking-bolao-copa-amigos.pdf"));
  dom.exportCsv.addEventListener("click", () => downloadExport("/api/admin/exports/ranking.csv", "ranking-bolao-copa-amigos.csv"));
  dom.saveEditParticipant.addEventListener("click", saveEditParticipant);
  dom.cancelEditParticipant.addEventListener("click", () => { dom.editParticipantPanel.hidden = true; });
  dom.participantsTable.addEventListener("click", onParticipantsTableClick);
}

function toast(text, type = "success") {
  dom.toast.textContent = text;
  dom.toast.className = `toast ${type} show`;
  clearTimeout(dom.toast._timer);
  dom.toast._timer = setTimeout(() => dom.toast.classList.remove("show"), 4000);
}

function showView(viewId) {
  dom.views.forEach((v) => v.classList.toggle("active", v.id === viewId));
  dom.nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
}

async function loadPublicData() {
  state.publicData = await api("/api/public");
  const closedText = state.publicData.closed ? "Palpites fechados" : "Palpites abertos";
  const deadlineText = state.publicData.settings.deadlineAt
    ? `Prazo: ${formatDateTime(state.publicData.settings.deadlineAt)}`
    : "Sem prazo definido";
  dom.statusText.textContent = `${closedText} · ${deadlineText}`;
  const url = `${location.origin}${location.pathname}`;
  dom.shareUrl.value = url;
  dom.shareMessage.value = `${state.publicData.settings.publicMessage}\n\n${url}`;
}

async function registerParticipant(event) {
  event.preventDefault();
  try {
    const participant = await api("/api/participants", {
      method: "POST",
      body: JSON.stringify({ name: dom.participantName.value, phone: dom.participantPhone.value })
    });
    localStorage.setItem("bolaoParticipantId", participant.id);
    state.participantSession = participant.id;

    const personalUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(participant.id)}`;
    const waMsg = `Bolao Copa Amigos — meus palpites:\n${personalUrl}`;

    dom.registrationResult.innerHTML = `
      <strong>Inscricao ${participant.registrationNumber} realizada!</strong>
      <span>Guarde este link para consultar ou alterar seus palpites antes do prazo.</span>
      <input id="personalLinkInput" class="personal-link-input" readonly value="${escapeAttr(personalUrl)}" />
      <div class="button-row">
        <button id="copyPersonalLink" class="secondary small" type="button">Copiar meu link</button>
        <button id="shareWaBtn" class="wa-btn small" type="button">Compartilhar pelo WhatsApp</button>
      </div>
    `;
    document.querySelector("#copyPersonalLink").addEventListener("click", () => {
      navigator.clipboard.writeText(personalUrl).catch(() => {});
      toast("Link copiado.");
    });
    document.querySelector("#shareWaBtn").addEventListener("click", () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, "_blank");
    });

    dom.participantIdInput.value = participant.id;
    dom.registerForm.reset();
    await loadParticipant(participant.id, false);
    showView("palpites");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function searchByPhone(event) {
  event.preventDefault();
  const phone = normalizePhone(dom.searchPhoneInput.value);
  if (phone.length < 8) {
    toast("Informe o celular com DDD.", "error");
    return;
  }
  try {
    const result = await api(`/api/participants/search?phone=${encodeURIComponent(phone)}`);
    dom.searchPhoneResult.hidden = false;
    dom.searchPhoneResult.innerHTML = `
      <strong>${escapeHtml(result.name)}</strong>
      <span>Inscricao ${result.registrationNumber}</span>
      <button class="primary small" id="loadFoundParticipant" type="button">Continuar preenchendo palpites</button>
    `;
    document.querySelector("#loadFoundParticipant").addEventListener("click", () => {
      dom.searchPhoneResult.hidden = true;
      dom.searchPhoneInput.value = "";
      loadParticipant(result.id, false);
    });
  } catch (error) {
    dom.searchPhoneResult.hidden = false;
    dom.searchPhoneResult.innerHTML = `<span>${escapeHtml(error.message)}</span>`;
  }
}

async function loadParticipant(id, notify) {
  if (!id) return;
  try {
    const data = await api(`/api/participants/${encodeURIComponent(id)}`);
    state.participantSession = id;
    localStorage.setItem("bolaoParticipantId", id);

    const deadline = state.publicData?.settings?.deadlineAt;
    const statusText = data.closed
      ? "Palpites encerrados."
      : deadline
        ? `Palpites abertos ate ${formatDateTime(deadline)}.`
        : "Palpites abertos.";

    dom.participantBox.innerHTML = `
      <strong>${escapeHtml(data.participant.name)}</strong>
      <span>Inscricao ${data.participant.registrationNumber} · ${escapeHtml(data.participant.phone)}</span>
      <span class="${data.closed ? "status-alert" : "status-ok"}">${statusText}</span>
    `;
    renderPredictionForms(data);
    if (notify) showView("palpites");
  } catch (error) {
    toast(error.message, "error");
  }
}

function renderPredictionForms(data) {
  const predMap = new Map(data.matchPredictions.map((p) => [p.matchId, p.choice]));

  dom.matchesList.innerHTML = data.groups
    .map((group) => {
      const groupMatches = data.matches.filter((m) => m.groupId === group.id);
      if (!groupMatches.length) return "";
      return `
        <section class="group-matches">
          <div class="group-heading">
            <h3 class="group-title">${escapeHtml(group.name)}</h3>
            <span>${groupMatches.length} jogos</span>
          </div>
          <div class="matches-grid">
            ${groupMatches
              .map((match) => {
                const sel = predMap.get(match.id) || "";
                const dis = data.closed ? "disabled" : "";
                const flagA = teamFlag(match.teamA);
                const flagB = teamFlag(match.teamB);
                return `
                  <article class="match-card">
                    <div class="match-header">
                      <span class="match-date">${formatDate(match.date)}</span>
                      <span class="match-time">${escapeHtml(match.time)}</span>
                    </div>
                    <div class="match-choices">
                      <button class="choice-btn team-choice${sel === "A" ? " selected selected-win" : ""}" data-match="${match.id}" data-choice="A" ${dis} type="button" aria-label="${escapeAttr(`${match.teamA} vence`)}">
                        <span class="team-flag" aria-hidden="true">${flagA}</span>
                        <span class="team-name">${escapeHtml(match.teamA)}</span>
                        <span class="choice-label">vence</span>
                      </button>
                      <button class="choice-btn draw-choice${sel === "D" ? " selected selected-draw" : ""}" data-match="${match.id}" data-choice="D" ${dis} type="button">
                        <span class="draw-label">Empate</span>
                      </button>
                      <button class="choice-btn team-choice team-choice-right${sel === "B" ? " selected selected-win" : ""}" data-match="${match.id}" data-choice="B" ${dis} type="button" aria-label="${escapeAttr(`${match.teamB} vence`)}">
                        <span class="team-flag" aria-hidden="true">${flagB}</span>
                        <span class="team-name">${escapeHtml(match.teamB)}</span>
                        <span class="choice-label">vence</span>
                      </button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");

  if (!data.closed) {
    dom.matchesList.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", onChoiceClick);
    });
  }

  dom.savePredictions.disabled = data.closed;
}

function onChoiceClick(event) {
  const btn = event.currentTarget;
  const matchId = btn.dataset.match;
  dom.matchesList.querySelectorAll(`[data-match="${matchId}"]`).forEach((b) => {
    b.classList.remove("selected", "selected-win", "selected-draw");
  });
  btn.classList.add("selected");
  btn.classList.add(btn.dataset.choice === "D" ? "selected-draw" : "selected-win");
}

async function savePredictions() {
  if (!state.participantSession) {
    toast("Carregue ou cadastre um participante primeiro.", "error");
    return;
  }
  const matchPredictions = [];
  dom.matchesList.querySelectorAll(".choice-btn.selected").forEach((btn) => {
    matchPredictions.push({ matchId: btn.dataset.match, choice: btn.dataset.choice });
  });
  try {
    const updated = await api(`/api/participants/${encodeURIComponent(state.participantSession)}/predictions`, {
      method: "PUT",
      body: JSON.stringify({ matchPredictions })
    });
    renderPredictionForms(updated);
    await renderRanking();
    toast("Palpites salvos.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: dom.adminUsername.value, password: dom.adminPassword.value })
    });
    state.adminToken = result.token;
    localStorage.setItem("bolaoAdminToken", result.token);
    dom.adminLoginForm.reset();
    await loadAdminData(true);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadAdminData(notify) {
  try {
    state.adminData = await api("/api/admin/data", { admin: true });
    dom.adminPanel.hidden = false;
    renderAdmin();
    if (notify) showView("admin");
  } catch {
    state.adminToken = "";
    localStorage.removeItem("bolaoAdminToken");
  }
}

function renderAdmin() {
  const data = state.adminData;
  dom.deadlineAt.value = data.settings.deadlineAt ? data.settings.deadlineAt.slice(0, 16) : "";
  dom.locked.checked = data.settings.locked;

  dom.participantsTable.innerHTML = data.participants.length
    ? data.participants
        .map((p) => `
          <tr>
            <td>${p.registrationNumber}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.phone)}</td>
            <td>${formatDateTime(p.createdAt)}</td>
            <td>
              <div class="button-row">
                <button class="secondary small" type="button" data-edit-id="${escapeAttr(p.id)}">Editar</button>
                <button class="danger small" type="button" data-delete-id="${escapeAttr(p.id)}" data-delete-name="${escapeAttr(p.name)}">Excluir</button>
              </div>
            </td>
          </tr>
        `).join("")
    : `<tr><td colspan="5">Nenhum participante cadastrado.</td></tr>`;

  const outcomeLabel = { A: "Time A venceu", D: "Empate", B: "Time B venceu" };

  dom.resultsList.innerHTML = data.matches
    .map((match) => {
      const outcome = (match.scoreA !== null && match.scoreB !== null)
        ? outcomeLabel[matchOutcome(match.scoreA, match.scoreB)]
        : null;
      return `
        <article class="match-card">
          <div class="match-meta">${escapeHtml(groupName(data.groups, match.groupId))} · ${formatDate(match.date)} · ${escapeHtml(match.time)}</div>
          <div class="match-line">
            <strong>${escapeHtml(match.teamA)}</strong>
            <input type="number" min="0" value="${match.scoreA ?? ""}" data-result-a="${match.id}" />
            <span>x</span>
            <input type="number" min="0" value="${match.scoreB ?? ""}" data-result-b="${match.id}" />
            <strong>${escapeHtml(match.teamB)}</strong>
          </div>
          ${outcome ? `<div class="outcome-line"><span class="outcome-badge">${escapeHtml(outcome)}</span></div>` : ""}
        </article>
      `;
    })
    .join("");

  renderRankingRows(data.ranking, dom.rankingTable, { showPhone: true });
}

function onParticipantsTableClick(event) {
  const editBtn = event.target.closest("[data-edit-id]");
  const deleteBtn = event.target.closest("[data-delete-id]");
  if (editBtn) openEditParticipant(editBtn.dataset.editId);
  if (deleteBtn) confirmDeleteParticipant(deleteBtn.dataset.deleteId, deleteBtn.dataset.deleteName);
}

function openEditParticipant(id) {
  const participant = state.adminData.participants.find((p) => p.id === id);
  if (!participant) return;
  dom.editParticipantPanel.dataset.editingId = id;
  dom.editName.value = participant.name;
  dom.editPhone.value = participant.phone;
  dom.editParticipantPanel.hidden = false;
  dom.editParticipantPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveEditParticipant() {
  const id = dom.editParticipantPanel.dataset.editingId;
  if (!id) return;
  try {
    await api(`/api/admin/participants/${encodeURIComponent(id)}`, {
      method: "PUT",
      admin: true,
      body: JSON.stringify({ name: dom.editName.value, phone: dom.editPhone.value })
    });
    dom.editParticipantPanel.hidden = true;
    await loadAdminData(false);
    toast("Participante atualizado.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function confirmDeleteParticipant(id, name) {
  if (!window.confirm(`Excluir "${name}" e todos os palpites vinculados?\nEsta acao nao pode ser desfeita.`)) return;
  try {
    await api(`/api/admin/participants/${encodeURIComponent(id)}`, { method: "DELETE", admin: true });
    if (state.participantSession === id) {
      state.participantSession = "";
      localStorage.removeItem("bolaoParticipantId");
    }
    dom.editParticipantPanel.hidden = true;
    await loadAdminData(false);
    await renderRanking();
    toast("Participante excluido.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function adminCopyPublicLink() {
  const url = `${location.origin}${location.pathname}`;
  try { await navigator.clipboard.writeText(url); } catch {}
  toast("Link publico copiado.");
}

async function adminCopyWhatsappMsg() {
  const url = `${location.origin}${location.pathname}`;
  const msg = state.publicData?.settings?.publicMessage || "Bolao Copa Amigos";
  try { await navigator.clipboard.writeText(`${msg}\n\n${url}`); } catch {}
  toast("Mensagem copiada.");
}

async function saveSettings() {
  try {
    await api("/api/admin/settings", {
      method: "PUT",
      admin: true,
      body: JSON.stringify({
        deadlineAt: dom.deadlineAt.value ? new Date(dom.deadlineAt.value).toISOString() : "",
        locked: dom.locked.checked
      })
    });
    await loadPublicData();
    await loadAdminData(false);
    toast("Configuracao salva.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveResults() {
  const results = state.adminData.matches.map((match) => ({
    matchId: match.id,
    scoreA: document.querySelector(`[data-result-a="${match.id}"]`)?.value ?? "",
    scoreB: document.querySelector(`[data-result-b="${match.id}"]`)?.value ?? ""
  }));
  try {
    await api("/api/admin/results", {
      method: "PUT",
      admin: true,
      body: JSON.stringify({ results })
    });
    await loadAdminData(false);
    await renderRanking();
    toast("Resultados salvos e pontuacao recalculada.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadExampleJson() {
  try {
    const resp = await fetch("/tabela-exemplo.json");
    if (!resp.ok) throw new Error("Arquivo nao encontrado.");
    dom.importJson.value = await resp.text();
    toast("Exemplo carregado. Revise e clique em Importar tabela.");
  } catch {
    toast("Nao foi possivel carregar o exemplo.", "error");
  }
}

async function importGames() {
  if (!dom.importJson.value.trim()) {
    toast("Cole um JSON com groups e matches.", "error");
    return;
  }
  if (!window.confirm("Atencao: importar novos jogos vai apagar todos os palpites existentes. Deseja continuar?")) return;
  try {
    const payload = JSON.parse(dom.importJson.value);
    const result = await api("/api/admin/matches/import", {
      method: "POST",
      admin: true,
      body: JSON.stringify(payload)
    });
    dom.importJson.value = "";
    await loadPublicData();
    await loadAdminData(false);
    const backupMsg = result.backup ? ` Backup salvo: data/${result.backup}.` : "";
    toast(`Jogos importados com sucesso.${backupMsg}`);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function downloadExport(path, filename) {
  try {
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${state.adminToken}` }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Erro ao exportar.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function renderRanking() {
  const ranking = await api("/api/ranking");
  renderRankingRows(ranking, dom.publicRanking, { showPhone: false });
}

function renderRankingRows(rows, target, { showPhone = true } = {}) {
  const cols = showPhone ? 4 : 3;
  target.innerHTML = rows.length
    ? rows
        .map((row) => `
          <tr>
            <td>${row.position}</td>
            <td>${escapeHtml(row.name)}</td>
            ${showPhone ? `<td>${escapeHtml(row.phone || "")}</td>` : ""}
            <td><strong>${row.points}</strong></td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="${cols}">Ranking vazio.</td></tr>`;
}

async function copyShareMessage() {
  const text = dom.shareMessage.value;
  try {
    await navigator.clipboard.writeText(text);
    toast("Mensagem copiada.");
  } catch {
    dom.shareMessage.select();
    document.execCommand("copy");
    toast("Mensagem copiada.");
  }
}

function groupName(groups, groupId) {
  return groups.find((g) => g.id === groupId)?.name || groupId;
}

function formatDate(value) {
  if (!value) return "Data a definir";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="fallback"><h1>Erro ao iniciar</h1><p>${escapeHtml(error.message)}</p></main>`;
});
