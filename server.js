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
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
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
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

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

function scoreOutcome(a, b) {
  if (a === b) return "draw";
  return a > b ? "A" : "B";
}

function calculateRanking(store) {
  return store.participants
    .map((participant) => {
      const matchPoints = store.matches.reduce((total, match) => {
        if (match.scoreA === null || match.scoreB === null) return total;
        const guess = store.matchPredictions.find((item) => item.participantId === participant.id && item.matchId === match.id);
        if (!guess) return total;
        if (guess.scoreA === match.scoreA && guess.scoreB === match.scoreB) return total + 5;
        if (scoreOutcome(guess.scoreA, guess.scoreB) === scoreOutcome(match.scoreA, match.scoreB)) return total + 2;
        return total;
      }, 0);

      const qualifiedPoints = store.groups.reduce((total, group) => {
        const realQualified = qualifiedFromResults(store, group.id);
        if (!realQualified.length) return total;
        const guesses = store.qualifiedPredictions
          .filter((item) => item.participantId === participant.id && item.groupId === group.id)
          .map((item) => item.team);
        const hits = new Set(guesses.filter((team) => realQualified.includes(team)));
        return total + hits.size * 25;
      }, 0);

      return {
        position: 0,
        id: participant.id,
        registrationNumber: participant.registrationNumber,
        name: participant.name,
        phone: participant.phone,
        matchPoints,
        qualifiedPoints,
        totalPoints: matchPoints + qualifiedPoints
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || b.matchPoints - a.matchPoints || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function qualifiedFromResults(store, groupId) {
  const group = store.groups.find((item) => item.id === groupId);
  if (!group) return [];
  const table = new Map(group.teams.map((team) => [team, { team, points: 0, goalDiff: 0, goalsFor: 0 }]));
  const groupMatches = store.matches.filter((match) => match.groupId === groupId);
  if (groupMatches.some((match) => match.scoreA === null || match.scoreB === null)) return [];

  groupMatches.forEach((match) => {
    const rowA = table.get(match.teamA);
    const rowB = table.get(match.teamB);
    rowA.goalsFor += match.scoreA;
    rowB.goalsFor += match.scoreB;
    rowA.goalDiff += match.scoreA - match.scoreB;
    rowB.goalDiff += match.scoreB - match.scoreA;
    if (match.scoreA === match.scoreB) {
      rowA.points += 1;
      rowB.points += 1;
    } else if (match.scoreA > match.scoreB) {
      rowA.points += 3;
    } else {
      rowB.points += 3;
    }
  });

  return [...table.values()]
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .slice(0, 2)
    .map((row) => row.team);
}

function participantPayload(store, participantId) {
  const participant = store.participants.find((item) => item.id === participantId);
  if (!participant) return null;
  return {
    participant,
    closed: isClosed(store.settings),
    groups: store.groups,
    matches: store.matches,
    matchPredictions: store.matchPredictions.filter((item) => item.participantId === participantId),
    qualifiedPredictions: store.qualifiedPredictions.filter((item) => item.participantId === participantId)
  };
}

function setParticipantPredictions(store, participantId, body) {
  const validMatchIds = new Set(store.matches.map((match) => match.id));
  const validGroups = new Map(store.groups.map((group) => [group.id, new Set(group.teams)]));

  const matchPredictions = Array.isArray(body.matchPredictions) ? body.matchPredictions : [];
  const qualifiedPredictions = Array.isArray(body.qualifiedPredictions) ? body.qualifiedPredictions : [];

  store.matchPredictions = store.matchPredictions.filter((item) => item.participantId !== participantId);
  matchPredictions.forEach((item) => {
    const scoreA = Number(item.scoreA);
    const scoreB = Number(item.scoreB);
    if (!validMatchIds.has(item.matchId) || !Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) return;
    store.matchPredictions.push({ participantId, matchId: item.matchId, scoreA, scoreB });
  });

  store.qualifiedPredictions = store.qualifiedPredictions.filter((item) => item.participantId !== participantId);
  qualifiedPredictions.forEach((item) => {
    const teams = validGroups.get(item.groupId);
    if (!teams || !teams.has(item.team)) return;
    const alreadyAdded = store.qualifiedPredictions.some((saved) => {
      return saved.participantId === participantId && saved.groupId === item.groupId && saved.team === item.team;
    });
    const groupCount = store.qualifiedPredictions.filter((saved) => saved.participantId === participantId && saved.groupId === item.groupId).length;
    if (!alreadyAdded && groupCount < 2) {
      store.qualifiedPredictions.push({ participantId, groupId: item.groupId, team: item.team });
    }
  });
}

function csvRanking(rows) {
  const header = ["Posicao", "Nome", "Celular", "Pontos jogos", "Pontos classificados", "Total"];
  return [header, ...rows.map((row) => [row.position, row.name, row.phone, row.matchPoints, row.qualifiedPoints, row.totalPoints])]
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
      "(Total) Tj",
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
      lines.push(`(${pdfText(row.totalPoints)}) Tj`);
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
    if (!Array.isArray(body.groups) || !Array.isArray(body.matches)) {
      sendJson(response, 400, { error: "Envie groups e matches em JSON." });
      return;
    }
    store.groups = body.groups;
    store.matches = body.matches.map((match, index) => ({
      id: match.id || `J${index + 1}`,
      groupId: match.groupId,
      date: match.date || "",
      time: match.time || "",
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: match.scoreA ?? null,
      scoreB: match.scoreB ?? null
    }));
    store.matchPredictions = [];
    store.qualifiedPredictions = [];
    writeStore(store);
    sendJson(response, 200, { groups: store.groups, matches: store.matches });
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
    sendJson(response, 200, calculateRanking(store));
    return;
  }

  if (request.method === "GET" && pathname === "/api/exports/ranking.csv") {
    const csv = csvRanking(calculateRanking(store));
    response.writeHead(200, {
      "Content-Type": contentTypes[".csv"],
      "Content-Disposition": "attachment; filename=ranking-bolao-copa-amigos.csv"
    });
    response.end(csv);
    return;
  }

  if (request.method === "GET" && pathname === "/api/exports/ranking.pdf") {
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
