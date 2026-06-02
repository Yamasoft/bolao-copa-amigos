const state = {
  publicData: null,
  participantSession: localStorage.getItem("bolaoParticipantId") || "",
  adminToken: localStorage.getItem("bolaoAdminToken") || "",
  adminData: null
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
  qualifiedList: document.querySelector("#qualifiedList"),
  savePredictions: document.querySelector("#savePredictions"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminUsername: document.querySelector("#adminUsername"),
  adminPassword: document.querySelector("#adminPassword"),
  adminPanel: document.querySelector("#adminPanel"),
  deadlineAt: document.querySelector("#deadlineAt"),
  locked: document.querySelector("#locked"),
  saveSettings: document.querySelector("#saveSettings"),
  participantsTable: document.querySelector("#participantsTable"),
  resultsList: document.querySelector("#resultsList"),
  saveResults: document.querySelector("#saveResults"),
  importJson: document.querySelector("#importJson"),
  importGames: document.querySelector("#importGames"),
  rankingTable: document.querySelector("#rankingTable"),
  publicRanking: document.querySelector("#publicRanking"),
  exportPdf: document.querySelector("#exportPdf"),
  exportCsv: document.querySelector("#exportCsv")
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.admin) headers.Authorization = `Bearer ${state.adminToken}`;

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao processar a solicitacao.");
  }
  return payload;
}

async function init() {
  bindEvents();
  await loadPublicData();
  await renderRanking();
  if (state.participantSession) await loadParticipant(state.participantSession, false);
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
  dom.savePredictions.addEventListener("click", savePredictions);
  dom.adminLoginForm.addEventListener("submit", loginAdmin);
  dom.saveSettings.addEventListener("click", saveSettings);
  dom.saveResults.addEventListener("click", saveResults);
  dom.importGames.addEventListener("click", importGames);
  dom.exportPdf.addEventListener("click", () => window.open("/api/exports/ranking.pdf", "_blank"));
  dom.exportCsv.addEventListener("click", () => window.open("/api/exports/ranking.csv", "_blank"));
}

function showView(viewId) {
  dom.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  dom.nav.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
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
      body: JSON.stringify({
        name: dom.participantName.value,
        phone: dom.participantPhone.value
      })
    });
    localStorage.setItem("bolaoParticipantId", participant.id);
    state.participantSession = participant.id;
    dom.registrationResult.innerHTML = `
      <strong>Inscricao ${participant.registrationNumber}</strong>
      <span>ID para acessar depois: ${participant.id}</span>
    `;
    dom.participantIdInput.value = participant.id;
    dom.registerForm.reset();
    await loadParticipant(participant.id, false);
    showView("palpites");
  } catch (error) {
    alert(error.message);
  }
}

async function loadParticipant(id, notify) {
  if (!id) return;
  try {
    const data = await api(`/api/participants/${encodeURIComponent(id)}`);
    state.participantSession = id;
    localStorage.setItem("bolaoParticipantId", id);
    dom.participantBox.innerHTML = `
      <strong>${escapeHtml(data.participant.name)}</strong>
      <span>Inscricao ${data.participant.registrationNumber} · ${escapeHtml(data.participant.phone)}</span>
      <span>${data.closed ? "Consulta liberada, alteracoes bloqueadas." : "Alteracoes liberadas antes do prazo."}</span>
    `;
    renderPredictionForms(data);
    if (notify) showView("palpites");
  } catch (error) {
    alert(error.message);
  }
}

function renderPredictionForms(data) {
  const matchMap = new Map(data.matchPredictions.map((item) => [item.matchId, item]));
  const qualifiedMap = new Map();
  data.qualifiedPredictions.forEach((item) => {
    if (!qualifiedMap.has(item.groupId)) qualifiedMap.set(item.groupId, []);
    qualifiedMap.get(item.groupId).push(item.team);
  });

  dom.matchesList.innerHTML = data.matches
    .map((match) => {
      const guess = matchMap.get(match.id) || {};
      return `
        <article class="match-card">
          <div class="match-meta">${escapeHtml(groupName(data.groups, match.groupId))} · ${formatDate(match.date)} · ${escapeHtml(match.time)}</div>
          <div class="match-line">
            <strong>${escapeHtml(match.teamA)}</strong>
            <input type="number" min="0" value="${guess.scoreA ?? ""}" data-match-a="${match.id}" ${data.closed ? "disabled" : ""} />
            <span>x</span>
            <input type="number" min="0" value="${guess.scoreB ?? ""}" data-match-b="${match.id}" ${data.closed ? "disabled" : ""} />
            <strong>${escapeHtml(match.teamB)}</strong>
          </div>
        </article>
      `;
    })
    .join("");

  dom.qualifiedList.innerHTML = data.groups
    .map((group) => {
      const selected = qualifiedMap.get(group.id) || [];
      return `
        <article class="group-card">
          <h3>${escapeHtml(group.name)}</h3>
          <div class="checkbox-grid">
            ${group.teams
              .map((team) => {
                const checked = selected.includes(team) ? "checked" : "";
                return `
                  <label class="check-row">
                    <input type="checkbox" value="${escapeAttr(team)}" data-qualified="${group.id}" ${checked} ${data.closed ? "disabled" : ""} />
                    ${escapeHtml(team)}
                  </label>
                `;
              })
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");

  dom.savePredictions.disabled = data.closed;
}

async function savePredictions() {
  if (!state.participantSession) {
    alert("Carregue ou cadastre um participante primeiro.");
    return;
  }

  const matchPredictions = [];
  state.publicData.matches.forEach((match) => {
    const scoreA = document.querySelector(`[data-match-a="${match.id}"]`)?.value;
    const scoreB = document.querySelector(`[data-match-b="${match.id}"]`)?.value;
    if (scoreA !== "" && scoreB !== "") matchPredictions.push({ matchId: match.id, scoreA: Number(scoreA), scoreB: Number(scoreB) });
  });

  const qualifiedPredictions = [];
  document.querySelectorAll("[data-qualified]:checked").forEach((input) => {
    const groupId = input.dataset.qualified;
    const count = qualifiedPredictions.filter((item) => item.groupId === groupId).length;
    if (count < 2) qualifiedPredictions.push({ groupId, team: input.value });
  });

  try {
    const updated = await api(`/api/participants/${encodeURIComponent(state.participantSession)}/predictions`, {
      method: "PUT",
      body: JSON.stringify({ matchPredictions, qualifiedPredictions })
    });
    renderPredictionForms(updated);
    await renderRanking();
    alert("Palpites salvos.");
  } catch (error) {
    alert(error.message);
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
    alert(error.message);
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
        .map((participant) => {
          return `
            <tr>
              <td>${participant.registrationNumber}</td>
              <td>${escapeHtml(participant.name)}</td>
              <td>${escapeHtml(participant.phone)}</td>
              <td>${formatDateTime(participant.createdAt)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="4">Nenhum participante cadastrado.</td></tr>`;

  dom.resultsList.innerHTML = data.matches
    .map((match) => {
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
        </article>
      `;
    })
    .join("");

  renderRankingRows(data.ranking, dom.rankingTable);
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
    alert("Configuracao salva.");
  } catch (error) {
    alert(error.message);
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
    alert("Resultados salvos e pontuacao recalculada.");
  } catch (error) {
    alert(error.message);
  }
}

async function importGames() {
  if (!dom.importJson.value.trim()) {
    alert("Cole um JSON com groups e matches.");
    return;
  }

  try {
    const payload = JSON.parse(dom.importJson.value);
    await api("/api/admin/matches/import", {
      method: "POST",
      admin: true,
      body: JSON.stringify(payload)
    });
    dom.importJson.value = "";
    await loadPublicData();
    await loadAdminData(false);
    alert("Jogos importados. Palpites anteriores foram limpos.");
  } catch (error) {
    alert(error.message);
  }
}

async function renderRanking() {
  const ranking = await api("/api/ranking");
  renderRankingRows(ranking, dom.publicRanking);
}

function renderRankingRows(rows, target) {
  target.innerHTML = rows.length
    ? rows
        .map((row) => {
          return `
            <tr>
              <td>${row.position}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.phone)}</td>
              <td>${row.matchPoints}</td>
              <td>${row.qualifiedPoints}</td>
              <td><strong>${row.totalPoints}</strong></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6">Ranking vazio.</td></tr>`;
}

async function copyShareMessage() {
  const text = dom.shareMessage.value;
  try {
    await navigator.clipboard.writeText(text);
    alert("Mensagem copiada.");
  } catch {
    dom.shareMessage.select();
    document.execCommand("copy");
    alert("Mensagem copiada.");
  }
}

function groupName(groups, groupId) {
  return groups.find((group) => group.id === groupId)?.name || groupId;
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
