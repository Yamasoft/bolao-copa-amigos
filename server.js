const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "store.json");
const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const tokenSecret = process.env.TOKEN_SECRET || "bolao-copa-amigos-dev-secret";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8"
};

const seedGroups = [
  { id: "A", name: "Grupo A", teams: ["Brasil", "Japao", "Canada", "Marrocos"] },
  { id: "B", name: "Grupo B", teams: ["Argentina", "Coreia do Sul", "Mexico", "Suecia"] },
  { id: "C", name: "Grupo C", teams: ["Franca", "Espanha", "Australia", "Egito"] },
  { id: "D", name: "Grupo D", teams: ["Inglaterra", "Portugal", "Uruguai", "Gana"] }
];

const seedMatches = seedGroups.flatMap((group) => {
  const [a, b, c, d] = group.teams;
  return [
    [a, b],
    [c, d],
    [a, c],
    [d, b],
    [d, a],
    [b, c]
  ].map(([teamA, teamB], index) => ({
    id: `${group.id}-${index + 1}`,
    groupId: group.id,
    date: `2026-06-${String(12 + index).padStart(2, "0")}`,
    time: `${String(13 + (index % 4) * 2).padStart(2, "0")}:00`,
    teamA,
    teamB,
    scoreA: null,
    scoreB: null
  }));
});

function createInitialStore() {
  return {
    nextRegistration: 1001,
    settings: {
      deadlineAt: "",
      locked: false,
      publicMessage: "Entre no Bolao Copa Amigos e preencha seus palpites da primeira fase."
    },
    groups: seedGroups,
    matches: seedMatches,
    participants: [],
    matchPredictions: [],
    qualifiedPredictions: []
  };
}

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(createInitialStore(), null, 2));
  }
}

function readStore() {
  ensureStore();
  const store = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  return migrateStore(store);
}

function migrateStore(store) {
  store.qualifiedPredictions = store.qualifiedPredictions || [];

  const hasOldPreds = store.matchPredictions.some(
    (p) => (p.scoreA !== undefined || p.scoreB !== undefined) && p.choice === undefined
  );
  const hasOldQualified = store.qualifiedPredictions.length > 0;

  if (hasOldPreds || hasOldQualified) {
    backupStore();
    store.matchPredictions = store.matchPredictions.filter((p) => p.choice !== undefined);
    store.qualifiedPredictions = [];
    writeStore(store);
  }

  return store;
}

function writeStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": contentTypes[".json"] });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text, type = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type });
  response.end(text);
}

function getBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isClosed(settings) {
  if (settings.locked) return true;
  if (!settings.deadlineAt) return false;
  return new Date(settings.deadlineAt).getTime() <= Date.now();
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({ user: adminUser, exp: Date.now() + 1000 * 60 * 60 * 8 })).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  } catch {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.user === adminUser && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(request, response) {
  if (verifyToken(request)) return true;
  sendJson(response, 401, { error: "Login admin obrigatorio." });
  return false;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "").slice(0, 24);
}

function matchOutcome(scoreA, scoreB) {
  if (scoreA === scoreB) return "D";
  return scoreA > scoreB ? "A" : "B";
}

function calculateRanking(store) {
  return store.participants
    .map((participant) => {
      const points = store.matches.reduce((total, match) => {
        if (match.scoreA === null || match.scoreB === null) return total;
        const guess = store.matchPredictions.find(
          (p) => p.participantId === participant.id && p.matchId === match.id
        );
        if (!guess || !guess.choice) return total;
        return guess.choice === matchOutcome(match.scoreA, match.scoreB) ? total + 1 : total;
      }, 0);

      return {
        position: 0,
        id: participant.id,
        registrationNumber: participant.registrationNumber,
        name: participant.name,
        phone: participant.phone,
        points
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function participantPayload(store, participantId) {
  const participant = store.participants.find((item) => item.id === participantId);
  if (!participant) return null;
  return {
    participant,
    closed: isClosed(store.settings),
    groups: store.groups,
    matches: store.matches,
    matchPredictions: store.matchPredictions.filter((item) => item.participantId === participantId)
  };
}

function setParticipantPredictions(store, participantId, body) {
  const validMatchIds = new Set(store.matches.map((match) => match.id));
  const validChoices = new Set(["A", "D", "B"]);

  const matchPredictions = Array.isArray(body.matchPredictions) ? body.matchPredictions : [];

  store.matchPredictions = store.matchPredictions.filter((item) => item.participantId !== participantId);
  matchPredictions.forEach((item) => {
    if (!validMatchIds.has(item.matchId) || !validChoices.has(item.choice)) return;
    store.matchPredictions.push({ participantId, matchId: item.matchId, choice: item.choice });
  });

  store.qualifiedPredictions = store.qualifiedPredictions.filter((item) => item.participantId !== participantId);
}

function csvRanking(rows) {
  const header = ["Posicao", "Nome", "Celular", "Pontos"];
  return [header, ...rows.map((row) => [row.position, row.name, row.phone, row.points])]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function createRankingPdf(rows) {
  const pageWidth = 595;
  const pageHeight = 842;
  const columns = [42, 88, 330, 455];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  const pages = [];
  let pageRows = [];
  let y = 730;

  rows.forEach((row) => {
    if (y < 72) {
      pages.push(pageRows);
      pageRows = [];
      y = 730;
    }
    pageRows.push({ row, y });
    y -= 22;
  });
  pages.push(pageRows);

  const pageRefs = [];
  pages.forEach((page, pageIndex) => {
    const lines = [
      "BT",
      "/F1 18 Tf",
      "42 795 Td",
      "(Ranking - Bolao Copa Amigos) Tj",
      "/F1 10 Tf",
      "0 -20 Td",
      `(${pdfText(`Gerado em ${new Date().toLocaleString("pt-BR")}`)}) Tj`,
      "ET",
      "BT",
      "/F1 11 Tf",
      `${columns[0]} 760 Td`,
      "(#) Tj",
      `${columns[1]} 760 Td`,
      "(Nome) Tj",
      `${columns[2]} 760 Td`,
      "(Celular) Tj",
      `${columns[3]} 760 Td`,
      "(Pontos) Tj",
      "ET"
    ];

    page.forEach(({ row, y: rowY }) => {
      lines.push("BT");
      lines.push("/F1 10 Tf");
      lines.push(`${columns[0]} ${rowY} Td`);
      lines.push(`(${pdfText(row.position)}) Tj`);
      lines.push(`${columns[1]} ${rowY} Td`);
      lines.push(`(${pdfText(row.name)}) Tj`);
      lines.push(`${columns[2]} ${rowY} Td`);
      lines.push(`(${pdfText(row.phone)}) Tj`);
      lines.push(`${columns[3]} ${rowY} Td`);
      lines.push(`(${pdfText(row.points)}) Tj`);
      lines.push("ET");
    });

    lines.push("BT");
    lines.push("/F1 9 Tf");
    lines.push("42 36 Td");
    lines.push(`(${pdfText(`Pagina ${pageIndex + 1} de ${pages.length}`)}) Tj`);
    lines.push("ET");

    const stream = lines.join("\n");
    const pageObject = objects.length + 1;
    const contentObject = objects.length + 2;
    pageRefs.push(`${pageObject} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  const output = ["%PDF-1.4"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output.join("\n")) + 1);
    output.push(`${index + 1} 0 obj`);
    output.push(object);
    output.push("endobj");
  });
  const xrefStart = Buffer.byteLength(output.join("\n")) + 1;
  output.push("xref");
  output.push(`0 ${objects.length + 1}`);
  output.push("0000000000 65535 f ");
  offsets.slice(1).forEach((offset) => output.push(`${String(offset).padStart(10, "0")} 00000 n `));
  output.push("trailer");
  output.push(`<< /Size ${objects.length + 1} /Root 1 0 R >>`);
  output.push("startxref");
  output.push(String(xrefStart));
  output.push("%%EOF");
  return Buffer.from(output.join("\n"), "utf8");
}

function pdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 74);
}

function backupStore() {
  if (!fs.existsSync(dataFile)) return null;
  const tag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(dataDir, `store-backup-${tag}.json`);
  fs.copyFileSync(dataFile, backupFile);
  return path.basename(backupFile);
}

function validateImport(body) {
  const errors = [];

  if (!Array.isArray(body.groups) || body.groups.length === 0) {
    errors.push("groups deve ser um array nao vazio.");
  } else {
    body.groups.forEach((group, i) => {
      if (!group.id || !String(group.id).trim()) errors.push(`groups[${i}]: id obrigatorio.`);
      if (!group.name || !String(group.name).trim()) errors.push(`groups[${i}]: name obrigatorio.`);
      if (!Array.isArray(group.teams) || group.teams.length < 2) {
        errors.push(`groups[${i}]: teams deve ter pelo menos 2 selecoes.`);
      } else if (group.teams.some((t) => !t || !String(t).trim())) {
        errors.push(`groups[${i}]: todos os times devem ter nome preenchido.`);
      }
      if (errors.length >= 10) return;
    });
  }

  if (!Array.isArray(body.matches) || body.matches.length === 0) {
    errors.push("matches deve ser um array nao vazio.");
  } else {
    const teamsByGroup = new Map();
    if (Array.isArray(body.groups)) {
      body.groups.forEach((g) => {
        if (g.id && Array.isArray(g.teams)) {
          teamsByGroup.set(String(g.id).trim(), new Set(g.teams.map((t) => String(t).trim())));
        }
      });
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const timeRe = /^\d{2}:\d{2}$/;

    for (let i = 0; i < body.matches.length; i++) {
      const match = body.matches[i];
      const pfx = `matches[${i}]`;
      if (!match.groupId) { errors.push(`${pfx}: groupId obrigatorio.`); continue; }
      if (!match.teamA) { errors.push(`${pfx}: teamA obrigatorio.`); continue; }
      if (!match.teamB) { errors.push(`${pfx}: teamB obrigatorio.`); continue; }
      if (String(match.teamA).trim() === String(match.teamB).trim()) {
        errors.push(`${pfx}: teamA e teamB nao podem ser iguais.`);
      }
      if (match.date && !dateRe.test(match.date)) errors.push(`${pfx}: date deve ser YYYY-MM-DD.`);
      if (match.time && !timeRe.test(match.time)) errors.push(`${pfx}: time deve ser HH:MM.`);
      const groupTeams = teamsByGroup.get(String(match.groupId).trim());
      if (!groupTeams) {
        errors.push(`${pfx}: groupId "${match.groupId}" nao encontrado em groups.`);
      } else {
        if (!groupTeams.has(String(match.teamA).trim())) {
          errors.push(`${pfx}: teamA "${match.teamA}" nao pertence ao grupo "${match.groupId}".`);
        }
        if (!groupTeams.has(String(match.teamB).trim())) {
          errors.push(`${pfx}: teamB "${match.teamB}" nao pertence ao grupo "${match.groupId}".`);
        }
      }
      if (errors.length >= 10) break;
    }
  }

  return errors;
}

async function routeApi(request, response, pathname) {
  const store = readStore();

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/public") {
    sendJson(response, 200, {
      settings: store.settings,
      closed: isClosed(store.settings),
      groups: store.groups,
      matches: store.matches
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/participants") {
    const body = await getBody(request);
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (name.length < 3 || phone.length < 8) {
      sendJson(response, 400, { error: "Informe nome completo e celular com WhatsApp." });
      return;
    }
    const participant = {
      id: crypto.randomUUID(),
      registrationNumber: store.nextRegistration++,
      name,
      phone,
      createdAt: new Date().toISOString()
    };
    store.participants.push(participant);
    writeStore(store);
    sendJson(response, 201, participant);
    return;
  }

  if (request.method === "GET" && pathname === "/api/participants/search") {
    const searchUrl = new URL(request.url, `http://localhost:${port}`);
    const phone = normalizePhone(searchUrl.searchParams.get("phone") || "");
    if (phone.length < 8) {
      sendJson(response, 400, { error: "Informe o celular com DDD." });
      return;
    }
    const found = store.participants.find((p) => p.phone === phone);
    if (!found) {
      sendJson(response, 404, { error: "Celular nao encontrado. Verifique o numero ou faca novo cadastro." });
      return;
    }
    sendJson(response, 200, { id: found.id, name: found.name, registrationNumber: found.registrationNumber });
    return;
  }

  const participantMatch = pathname.match(/^\/api\/participants\/([^/]+)$/);
  if (request.method === "GET" && participantMatch) {
    const payload = participantPayload(store, participantMatch[1]);
    if (!payload) sendJson(response, 404, { error: "Participante nao encontrado." });
    else sendJson(response, 200, payload);
    return;
  }

  const predictionsMatch = pathname.match(/^\/api\/participants\/([^/]+)\/predictions$/);
  if (request.method === "PUT" && predictionsMatch) {
    if (isClosed(store.settings)) {
      sendJson(response, 403, { error: "O prazo de envio dos palpites esta fechado." });
      return;
    }
    const participantId = predictionsMatch[1];
    if (!store.participants.some((participant) => participant.id === participantId)) {
      sendJson(response, 404, { error: "Participante nao encontrado." });
      return;
    }
    const body = await getBody(request);
    setParticipantPredictions(store, participantId, body);
    writeStore(store);
    sendJson(response, 200, participantPayload(store, participantId));
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/login") {
    const body = await getBody(request);
    if (body.username === adminUser && body.password === adminPassword) {
      sendJson(response, 200, { token: createToken() });
    } else {
      sendJson(response, 401, { error: "Usuario ou senha invalidos." });
    }
    return;
  }

  if (pathname.startsWith("/api/admin") && !requireAdmin(request, response)) return;

  if (request.method === "GET" && pathname === "/api/admin/data") {
    sendJson(response, 200, {
      settings: store.settings,
      closed: isClosed(store.settings),
      groups: store.groups,
      matches: store.matches,
      participants: store.participants,
      ranking: calculateRanking(store)
    });
    return;
  }

  if (request.method === "PUT" && pathname === "/api/admin/settings") {
    const body = await getBody(request);
    store.settings.deadlineAt = String(body.deadlineAt || "");
    store.settings.locked = Boolean(body.locked);
    writeStore(store);
    sendJson(response, 200, { settings: store.settings, closed: isClosed(store.settings) });
    return;
  }

  if (request.method === "PUT" && pathname === "/api/admin/results") {
    const body = await getBody(request);
    const results = Array.isArray(body.results) ? body.results : [];
    results.forEach((result) => {
      const match = store.matches.find((item) => item.id === result.matchId);
      if (!match) return;
      const scoreA = result.scoreA === "" || result.scoreA === null ? null : Number(result.scoreA);
      const scoreB = result.scoreB === "" || result.scoreB === null ? null : Number(result.scoreB);
      match.scoreA = Number.isInteger(scoreA) && scoreA >= 0 ? scoreA : null;
      match.scoreB = Number.isInteger(scoreB) && scoreB >= 0 ? scoreB : null;
    });
    writeStore(store);
    sendJson(response, 200, { matches: store.matches, ranking: calculateRanking(store) });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/matches/import") {
    const body = await getBody(request);
    const errors = validateImport(body);
    if (errors.length) {
      sendJson(response, 400, { error: errors.join(" | ") });
      return;
    }
    const backupName = backupStore();
    store.groups = body.groups.map((g) => ({
      id: String(g.id).trim(),
      name: String(g.name).trim(),
      teams: g.teams.map((t) => String(t).trim())
    }));
    store.matches = body.matches.map((match, index) => ({
      id: match.id || `J${index + 1}`,
      groupId: String(match.groupId).trim(),
      date: match.date || "",
      time: match.time || "",
      teamA: String(match.teamA).trim(),
      teamB: String(match.teamB).trim(),
      scoreA: match.scoreA ?? null,
      scoreB: match.scoreB ?? null
    }));
    store.matchPredictions = [];
    store.qualifiedPredictions = [];
    writeStore(store);
    sendJson(response, 200, { groups: store.groups, matches: store.matches, backup: backupName });
    return;
  }

  const adminParticipantMatch = pathname.match(/^\/api\/admin\/participants\/([^/]+)$/);

  if (request.method === "PUT" && adminParticipantMatch) {
    const body = await getBody(request);
    const id = adminParticipantMatch[1];
    const participant = store.participants.find((p) => p.id === id);
    if (!participant) {
      sendJson(response, 404, { error: "Participante nao encontrado." });
      return;
    }
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (name.length < 3 || phone.length < 8) {
      sendJson(response, 400, { error: "Informe nome completo e celular com WhatsApp." });
      return;
    }
    participant.name = name;
    participant.phone = phone;
    writeStore(store);
    sendJson(response, 200, participant);
    return;
  }

  if (request.method === "DELETE" && adminParticipantMatch) {
    const id = adminParticipantMatch[1];
    const index = store.participants.findIndex((p) => p.id === id);
    if (index === -1) {
      sendJson(response, 404, { error: "Participante nao encontrado." });
      return;
    }
    store.participants.splice(index, 1);
    store.matchPredictions = store.matchPredictions.filter((p) => p.participantId !== id);
    store.qualifiedPredictions = store.qualifiedPredictions.filter((p) => p.participantId !== id);
    writeStore(store);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/ranking") {
    const ranking = calculateRanking(store).map(({ phone: _p, ...rest }) => rest);
    sendJson(response, 200, ranking);
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/exports/ranking.csv") {
    const csv = csvRanking(calculateRanking(store));
    response.writeHead(200, {
      "Content-Type": contentTypes[".csv"],
      "Content-Disposition": "attachment; filename=ranking-bolao-copa-amigos.csv"
    });
    response.end(csv);
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/exports/ranking.pdf") {
    const pdf = createRankingPdf(calculateRanking(store));
    response.writeHead(200, {
      "Content-Type": contentTypes[".pdf"],
      "Content-Disposition": "attachment; filename=ranking-bolao-copa-amigos.pdf"
    });
    response.end(pdf);
    return;
  }

  sendJson(response, 404, { error: "Rota nao encontrada." });
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(response, 404, "Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://localhost:${port}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      await routeApi(request, response, requestUrl.pathname);
      return;
    }
    serveStatic(request, response, requestUrl.pathname);
  } catch (error) {
    sendJson(response, 500, { error: "Erro interno.", detail: error.message });
  }
});

ensureStore();
server.listen(port, () => {
  console.log(`Bolao Copa Amigos em http://localhost:${port}`);
});
