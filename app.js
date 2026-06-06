const state = {
  publicData: null,
  participantData: null,
  participantSession: localStorage.getItem("bolaoParticipantId") || "",
  adminToken: localStorage.getItem("bolaoAdminToken") || "",
  adminData: null,
  pwaInstallPrompt: null
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.pwaInstallPrompt = e;
  if (dom.installPwaBtn) dom.installPwaBtn.hidden = false;
});

const TEAM_FLAGS = {
  "africa do sul": "ZA",
  alemanha: "DE",
  "arabia saudita": "SA",
  argelia: "DZ",
  argentina: "AR",
  australia: "AU",
  austria: "AT",
  belgica: "BE",
  bosnia: "BA",
  brasil: "BR",
  "cabo verde": "CV",
  canada: "CA",
  catar: "QA",
  colombia: "CO",
  "coreia do sul": "KR",
  "costa do marfim": "CI",
  croacia: "HR",
  curacao: "CW",
  egito: "EG",
  equador: "EC",
  escocia: "SCT",
  espanha: "ES",
  "estados unidos": "US",
  franca: "FR",
  frança: "FR",
  gana: "GH",
  haiti: "HT",
  holanda: "NL",
  inglaterra: "ENG",
  ira: "IR",
  iraque: "IQ",
  japao: "JP",
  japão: "JP",
  jordania: "JO",
  marrocos: "MA",
  mexico: "MX",
  méxico: "MX",
  noruega: "NO",
  "nova zelandia": "NZ",
  panama: "PA",
  paraguai: "PY",
  portugal: "PT",
  "rd congo": "CD",
  "republica tcheca": "CZ",
  senegal: "SN",
  suecia: "SE",
  suica: "CH",
  suiça: "CH",
  tunisia: "TN",
  turquia: "TR",
  uruguai: "UY",
  uzbequistao: "UZ"
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
  adminCopyInstall: document.querySelector("#adminCopyInstall"),
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
  toast: document.querySelector("#toast"),
  mobileMatchesList: document.querySelector("#mobileMatchesList"),
  mobileSendBtn: document.querySelector("#mobileSendBtn"),
  mobileParticipantName: document.querySelector("#mobileParticipantName"),
  mobileParticipantPhone: document.querySelector("#mobileParticipantPhone"),
  mobileTabEntrar: document.querySelector("#mobileTabEntrar"),
  mobileTabCriar: document.querySelector("#mobileTabCriar"),
  tabEntrar: document.querySelector("#tabEntrar"),
  tabCriar: document.querySelector("#tabCriar"),
  mobileLoginPhone: document.querySelector("#mobileLoginPhone"),
  mobilePasswordEntrar: document.querySelector("#mobilePasswordEntrar"),
  mobilePasswordCriar: document.querySelector("#mobilePasswordCriar"),
  mobileRegisterBtn: document.querySelector("#mobileRegisterBtn"),
  mobileLoginBtn: document.querySelector("#mobileLoginBtn"),
  mobileSaveBar: document.querySelector("#mobileSaveBar"),
  mobileIdBox: document.querySelector("#mobileIdBox"),
  mobileParticipantInfo: document.querySelector("#mobileParticipantInfo"),
  mpiDetails: document.querySelector("#mpiDetails"),
  openRegulamento: document.querySelector("#openRegulamento"),
  regulamentoModal: document.querySelector("#regulamentoModal"),
  closeRegulamento: document.querySelector("#closeRegulamento"),
  installPwaBtn: document.querySelector("#installPwaBtn"),
  mobileViewTabs: document.querySelector("#mobileViewTabs"),
  mvtPalpites: document.querySelector("#mvtPalpites"),
  mvtRanking: document.querySelector("#mvtRanking"),
  mobileRankingPanel: document.querySelector("#mobileRankingPanel")
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

function flagEmoji(code) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const base = 127397;
  return String.fromCodePoint(...code.split("").map((letter) => base + letter.charCodeAt(0)));
}

function teamFlagInfo(team) {
  const raw = String(team || "").toLowerCase().trim();
  const code = TEAM_FLAGS[raw] || TEAM_FLAGS[normalizeTeamName(team)] || "";
  return {
    code,
    emoji: flagEmoji(code)
  };
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  bindEvents();
  await loadPublicData();
  await renderRanking();
  const isMobile = window.innerWidth <= 640;

  if (isMobile) renderMobileInitialMatches();

  const urlId = new URLSearchParams(location.search).get("id");
  if (urlId) {
    await loadParticipant(urlId, !isMobile);
    if (isMobile && state.participantData) {
      showMobileIdentified(state.participantData, state.publicData?.closed);
    }
  } else if (state.participantSession) {
    await loadParticipant(state.participantSession, false);
    if (isMobile) {
      if (state.participantData) {
        showMobileIdentified(state.participantData, state.publicData?.closed);
      } else {
        state.participantSession = "";
        localStorage.removeItem("bolaoParticipantId");
      }
    }
  }

  if (isMobile) showView("mobile-flow");
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
  dom.mobileSendBtn.addEventListener("click", mobileSendPalpites);
  dom.mobileRegisterBtn.addEventListener("click", mobileRegister);
  dom.mobileLoginBtn.addEventListener("click", mobileLogin);
  dom.mobileTabEntrar.addEventListener("click", () => switchMobileTab("entrar"));
  dom.mobileTabCriar.addEventListener("click", () => switchMobileTab("criar"));
  applyPhoneMask(dom.mobileParticipantPhone);
  applyPhoneMask(dom.mobileLoginPhone);
  dom.adminLoginForm.addEventListener("submit", loginAdmin);
  dom.adminCopyLink.addEventListener("click", adminCopyPublicLink);
  dom.adminCopyWhatsapp.addEventListener("click", adminCopyWhatsappMsg);
  dom.adminCopyInstall.addEventListener("click", adminCopyInstallMsg);
  dom.saveSettings.addEventListener("click", saveSettings);
  dom.saveResults.addEventListener("click", saveResults);
  dom.importGames.addEventListener("click", importGames);
  dom.loadExample.addEventListener("click", loadExampleJson);
  dom.exportPdf.addEventListener("click", () => downloadExport("/api/admin/exports/ranking.pdf", "ranking-bolao-copa-amigos.pdf"));
  dom.exportCsv.addEventListener("click", () => downloadExport("/api/admin/exports/ranking.csv", "ranking-bolao-copa-amigos.csv"));
  dom.saveEditParticipant.addEventListener("click", saveEditParticipant);
  dom.cancelEditParticipant.addEventListener("click", () => { dom.editParticipantPanel.hidden = true; });
  dom.participantsTable.addEventListener("click", onParticipantsTableClick);
  dom.openRegulamento.addEventListener("click", () => { dom.regulamentoModal.hidden = false; });
  dom.closeRegulamento.addEventListener("click", () => { dom.regulamentoModal.hidden = true; });
  dom.regulamentoModal.addEventListener("click", (e) => { if (e.target === dom.regulamentoModal) dom.regulamentoModal.hidden = true; });
  dom.installPwaBtn.addEventListener("click", async () => {
    if (!state.pwaInstallPrompt) return;
    state.pwaInstallPrompt.prompt();
    await state.pwaInstallPrompt.userChoice;
    state.pwaInstallPrompt = null;
    dom.installPwaBtn.hidden = true;
  });
  dom.mvtPalpites.addEventListener("click", () => switchMobileViewTab("palpites"));
  dom.mvtRanking.addEventListener("click", () => switchMobileViewTab("ranking"));
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
    state.participantData = data.participant;
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
  const predMap = new Map(
    (data.matchPredictions || []).map((p) => [p.matchId, { homeScore: p.homeScore, awayScore: p.awayScore }])
  );

  const html = data.groups
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
                const pred = predMap.get(match.id);
                const homeVal = pred != null && pred.homeScore != null ? pred.homeScore : "";
                const awayVal = pred != null && pred.awayScore != null ? pred.awayScore : "";
                const dis = data.closed ? "disabled" : "";
                const flagA = teamFlagInfo(match.teamA);
                const flagB = teamFlagInfo(match.teamB);
                return `
                  <article class="match-card">
                    <div class="match-header">
                      <span class="match-date">${formatDate(match.date)}</span>
                      <span class="match-time">${escapeHtml(match.time)}</span>
                    </div>
                    <div class="match-score-row">
                      <div class="score-team score-team-left">
                        <span class="team-flag" aria-hidden="true"><span class="flag-emoji">${flagA.emoji}</span></span>
                        <span class="team-name">${escapeHtml(match.teamA)}</span>
                      </div>
                      <div class="score-inputs">
                        <div class="score-stepper">
                          <button class="stepper-btn stepper-dec" data-match="${match.id}" data-side="home" type="button" ${dis} aria-label="Diminuir">−</button>
                          <input class="score-input" type="number" min="0" max="99" data-match="${match.id}" data-side="home" value="${homeVal}" ${dis} inputmode="numeric" aria-label="Gols ${escapeAttr(match.teamA)}" />
                          <button class="stepper-btn stepper-inc" data-match="${match.id}" data-side="home" type="button" ${dis} aria-label="Aumentar">+</button>
                        </div>
                        <span class="score-sep">×</span>
                        <div class="score-stepper">
                          <button class="stepper-btn stepper-dec" data-match="${match.id}" data-side="away" type="button" ${dis} aria-label="Diminuir">−</button>
                          <input class="score-input" type="number" min="0" max="99" data-match="${match.id}" data-side="away" value="${awayVal}" ${dis} inputmode="numeric" aria-label="Gols ${escapeAttr(match.teamB)}" />
                          <button class="stepper-btn stepper-inc" data-match="${match.id}" data-side="away" type="button" ${dis} aria-label="Aumentar">+</button>
                        </div>
                      </div>
                      <div class="score-team score-team-right">
                        <span class="team-flag" aria-hidden="true"><span class="flag-emoji">${flagB.emoji}</span></span>
                        <span class="team-name">${escapeHtml(match.teamB)}</span>
                      </div>
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

  [dom.matchesList, dom.mobileMatchesList].forEach((container) => {
    if (!container) return;
    container.innerHTML = html;
    if (!data.closed) {
      container.querySelectorAll(".stepper-btn").forEach((btn) => {
        btn.addEventListener("click", onStepperClick);
      });
    }
  });

  dom.savePredictions.disabled = data.closed;
  if (dom.mobileSendBtn) dom.mobileSendBtn.disabled = data.closed;
}

function collectScorePredictions(container) {
  const scores = {};
  container.querySelectorAll(".score-input").forEach((input) => {
    const matchId = input.dataset.match;
    const side = input.dataset.side;
    if (!scores[matchId]) scores[matchId] = {};
    scores[matchId][side] = input.value;
  });
  return Object.entries(scores)
    .filter(([, v]) => v.home !== "" && v.away !== "")
    .map(([matchId, v]) => ({ matchId, homeScore: parseInt(v.home), awayScore: parseInt(v.away) }))
    .filter((p) => !isNaN(p.homeScore) && !isNaN(p.awayScore));
}

function onStepperClick(e) {
  const btn = e.currentTarget;
  const inc = btn.classList.contains("stepper-inc");
  const container = btn.closest("#matchesList, #mobileMatchesList");
  const input = container.querySelector(`.score-input[data-match="${btn.dataset.match}"][data-side="${btn.dataset.side}"]`);
  const current = input.value === "" ? 0 : parseInt(input.value) || 0;
  input.value = inc ? current + 1 : Math.max(0, current - 1);
}

async function savePredictions() {
  if (!state.participantSession) {
    toast("Carregue ou cadastre um participante primeiro.", "error");
    return;
  }
  const matchPredictions = collectScorePredictions(dom.matchesList);
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

async function adminCopyInstallMsg() {
  const url = `${location.origin}${location.pathname}`;
  const msg = [
    "📲 *Como instalar o Bolão Copa Amigos no celular*",
    "",
    `Acesse: ${url}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "📱 *Android (Chrome):*",
    "1. Abra o link acima no Chrome",
    "2. Toque no menu ⋮ (três pontos) no canto superior direito",
    "3. Toque em *\"Adicionar à tela inicial\"* ou *\"Instalar app\"*",
    "4. Confirme tocando em *Instalar*",
    "",
    "🍎 *iPhone (Safari):*",
    "1. Abra o link acima no *Safari* (não no Chrome)",
    "2. Toque no botão *Compartilhar* 🔗 (quadrado com seta para cima)",
    "3. Role para baixo e toque em *\"Adicionar à Tela de Início\"*",
    "4. Toque em *Adicionar*",
    "",
    "Depois de instalar, o app abre em tela cheia, sem barra do browser. ✅"
  ].join("\n");
  try { await navigator.clipboard.writeText(msg); } catch {}
  toast("Mensagem de instalação copiada!");
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

async function renderMobileRanking() {
  try {
    const ranking = await api("/api/ranking");
    if (!ranking.length) {
      dom.mobileRankingPanel.innerHTML = '<p class="mobile-ranking-empty">Nenhum palpite enviado ainda.</p>';
      return;
    }
    const myId = state.participantSession;
    dom.mobileRankingPanel.innerHTML = `
      <div class="mobile-ranking-wrap">
        <h3 class="mobile-ranking-title">🏅 Ranking</h3>
        <div class="mobile-ranking-list">
          ${ranking.map((row) => {
            const isMe = row.id === myId;
            const medal = row.position === 1 ? "🥇" : row.position === 2 ? "🥈" : row.position === 3 ? "🥉" : `${row.position}º`;
            return `
              <div class="mobile-ranking-row${isMe ? " mobile-ranking-me" : ""}">
                <span class="mrk-pos">${medal}</span>
                <span class="mrk-name">${escapeHtml(row.name)}${isMe ? ' <span class="mrk-you">você</span>' : ""}</span>
                <span class="mrk-pts">${row.points} <small>pts</small></span>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  } catch {
    dom.mobileRankingPanel.innerHTML = '<p class="mobile-ranking-empty">Erro ao carregar ranking.</p>';
  }
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

function applyPhoneMask(input) {
  input.addEventListener("input", () => {
    let v = input.value.replace(/\D/g, "").slice(0, 11);
    if (v.length === 0) {
      input.value = "";
    } else if (v.length <= 2) {
      input.value = `(${v}`;
    } else if (v.length <= 7) {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length <= 10) {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    }
  });
}

function prefillMobileForm() {
  if (!state.participantData) return;
  showMobileIdentified(state.participantData, state.publicData?.closed);
}

function renderMobileInitialMatches() {
  if (!state.publicData?.matches?.length) return;
  renderPredictionForms({
    groups: state.publicData.groups,
    matches: state.publicData.matches,
    matchPredictions: [],
    closed: state.publicData.closed
  });
}

function switchMobileTab(tab) {
  dom.mobileTabEntrar.classList.toggle("active", tab === "entrar");
  dom.mobileTabCriar.classList.toggle("active", tab === "criar");
  dom.tabEntrar.classList.toggle("active", tab === "entrar");
  dom.tabCriar.classList.toggle("active", tab === "criar");
}

function showMobileIdentified(participant, closed) {
  dom.mobileIdBox.hidden = true;
  dom.mobileParticipantInfo.hidden = false;
  dom.mpiDetails.innerHTML = `
    <strong>${escapeHtml(participant.name)}</strong>
    <span>Inscrição ${participant.registrationNumber}</span>
  `;
  dom.mobileViewTabs.hidden = false;
  dom.mobileMatchesList.hidden = false;
  dom.mobileRankingPanel.hidden = true;
  dom.mobileSaveBar.hidden = !!closed;
  dom.mobileSendBtn.disabled = !!closed;
  dom.mobileSendBtn.innerHTML = closed
    ? '<span aria-hidden="true">🔒</span>Palpites encerrados'
    : '<span aria-hidden="true">✓</span>Salvar palpites';
  dom.mvtPalpites.classList.add("active");
  dom.mvtRanking.classList.remove("active");
}

function switchMobileViewTab(tab) {
  const isPalpites = tab === "palpites";
  dom.mvtPalpites.classList.toggle("active", isPalpites);
  dom.mvtRanking.classList.toggle("active", !isPalpites);
  dom.mobileMatchesList.hidden = !isPalpites;
  dom.mobileRankingPanel.hidden = isPalpites;
  dom.mobileSaveBar.hidden = !isPalpites || !!state.publicData?.closed;
  if (!isPalpites) renderMobileRanking();
}

async function mobileLogin() {
  const phone = normalizePhone(dom.mobileLoginPhone.value);
  const password = dom.mobilePasswordEntrar.value;
  if (phone.length < 8) { toast("Informe o celular com DDD.", "error"); return; }
  if (!password) { toast("Informe sua senha.", "error"); return; }
  try {
    const found = await api("/api/participants/login", {
      method: "POST",
      body: JSON.stringify({ phone, password })
    });
    state.participantSession = found.id;
    localStorage.setItem("bolaoParticipantId", found.id);
    await loadParticipant(found.id, false);
    if (state.participantData) {
      showMobileIdentified(state.participantData, state.publicData?.closed);
      toast(`Bem-vindo, ${found.name}!`);
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

async function mobileRegister() {
  const name = dom.mobileParticipantName.value.trim();
  const phone = normalizePhone(dom.mobileParticipantPhone.value);
  const password = dom.mobilePasswordCriar.value;
  if (name.length < 3) { toast("Informe seu nome completo.", "error"); return; }
  if (phone.length < 8) { toast("Informe o celular com DDD.", "error"); return; }
  if (password.length < 4) { toast("Crie uma senha com pelo menos 4 caracteres.", "error"); return; }
  try {
    const participant = await api("/api/participants", {
      method: "POST",
      body: JSON.stringify({ name, phone: dom.mobileParticipantPhone.value.trim(), password })
    });
    state.participantSession = participant.id;
    state.participantData = participant;
    localStorage.setItem("bolaoParticipantId", participant.id);
    showMobileIdentified(participant, state.publicData?.closed);
    toast("Conta criada! Faça seus palpites e clique em Salvar.");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function mobileSendPalpites() {
  if (!state.participantSession) { toast("Faça login ou crie uma conta primeiro.", "error"); return; }

  const matchPredictions = collectScorePredictions(dom.mobileMatchesList);

  try {
    const updated = await api(`/api/participants/${encodeURIComponent(state.participantSession)}/predictions`, {
      method: "PUT",
      body: JSON.stringify({ matchPredictions })
    });
    renderPredictionForms(updated);
    await renderRanking();
    if (state.participantData) showMobileIdentified(state.participantData, updated.closed);
    toast("Palpites enviados!");
  } catch (error) {
    toast(error.message, "error");
  }
}

init().catch((error) => {
  document.body.innerHTML = `<main class="fallback"><h1>Erro ao iniciar</h1><p>${escapeHtml(error.message)}</p></main>`;
});
