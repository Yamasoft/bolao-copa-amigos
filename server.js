const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "store.json");
const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const tokenSecret = process.env.TOKEN_SECRET || "bolao-copa-amigos-dev-secret";

// ── PNG icon generator (no external deps) ──────────────────────────────────
function pngCrc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(crcInput), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makeSolidPng(size, hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB color type

  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      raw[off + 1 + x * 3] = r;
      raw[off + 1 + x * 3 + 1] = g;
      raw[off + 1 + x * 3 + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdrData), pngChunk("IDAT", compressed), pngChunk("IEND", Buffer.alloc(0))]);
}

const icon192png = makeSolidPng(192, "#12613d");
const icon512png = makeSolidPng(512, "#12613d");
// ────────────────────────────────────────────────────────────────────────────

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

// Grupos A-J confirmados via ge.globo.com/futebol/copa-do-mundo (02/06/2026).
// Rodada 1: datas e horarios confirmados. Rodadas 2 e 3: datas estimadas (+4/+8 dias).
// Grupos K e L nao vistos nas screenshots — importe a tabela completa pelo painel admin.
const seedGroups = [
  { id: "A", name: "Grupo A", teams: ["Mexico", "Africa do Sul", "Coreia do Sul", "Republica Tcheca"] },
  { id: "B", name: "Grupo B", teams: ["Canada", "Bosnia", "Catar", "Suica"] },
  { id: "C", name: "Grupo C", teams: ["Brasil", "Marrocos", "Haiti", "Escocia"] },
  { id: "D", name: "Grupo D", teams: ["Estados Unidos", "Paraguai", "Australia", "Turquia"] },
  { id: "E", name: "Grupo E", teams: ["Alemanha", "Curacao", "Costa do Marfim", "Equador"] },
  { id: "F", name: "Grupo F", teams: ["Holanda", "Japao", "Suecia", "Tunisia"] },
  { id: "G", name: "Grupo G", teams: ["Belgica", "Egito", "Ira", "Nova Zelandia"] },
  { id: "H", name: "Grupo H", teams: ["Espanha", "Cabo Verde", "Arabia Saudita", "Uruguai"] },
  { id: "I", name: "Grupo I", teams: ["Franca", "Senegal", "Iraque", "Noruega"] },
  { id: "J", name: "Grupo J", teams: ["Argentina",  "Argelia",  "Austria",     "Jordania"    ] },
  { id: "K", name: "Grupo K", teams: ["Portugal",   "RD Congo", "Uzbequistao", "Colombia"    ] },
  { id: "L", name: "Grupo L", teams: ["Inglaterra", "Croacia",  "Gana",        "Panama"      ] }
];

const seedMatches = [
  // ── Grupo A ────────────────────────────────────────────
  { id: "A-1", groupId: "A", date: "2026-06-11", time: "16:00", teamA: "Mexico",          teamB: "Africa do Sul"    },
  { id: "A-2", groupId: "A", date: "2026-06-11", time: "23:00", teamA: "Coreia do Sul",   teamB: "Republica Tcheca" },
  { id: "A-3", groupId: "A", date: "2026-06-15", time: "16:00", teamA: "Mexico",          teamB: "Coreia do Sul"    },
  { id: "A-4", groupId: "A", date: "2026-06-15", time: "20:00", teamA: "Africa do Sul",   teamB: "Republica Tcheca" },
  { id: "A-5", groupId: "A", date: "2026-06-19", time: "20:00", teamA: "Mexico",          teamB: "Republica Tcheca" },
  { id: "A-6", groupId: "A", date: "2026-06-19", time: "20:00", teamA: "Africa do Sul",   teamB: "Coreia do Sul"    },
  // ── Grupo B ────────────────────────────────────────────
  { id: "B-1", groupId: "B", date: "2026-06-12", time: "16:00", teamA: "Canada",          teamB: "Bosnia"           },
  { id: "B-2", groupId: "B", date: "2026-06-13", time: "16:00", teamA: "Catar",           teamB: "Suica"            },
  { id: "B-3", groupId: "B", date: "2026-06-16", time: "16:00", teamA: "Canada",          teamB: "Catar"            },
  { id: "B-4", groupId: "B", date: "2026-06-17", time: "16:00", teamA: "Bosnia",          teamB: "Suica"            },
  { id: "B-5", groupId: "B", date: "2026-06-20", time: "20:00", teamA: "Canada",          teamB: "Suica"            },
  { id: "B-6", groupId: "B", date: "2026-06-20", time: "20:00", teamA: "Bosnia",          teamB: "Catar"            },
  // ── Grupo C ────────────────────────────────────────────
  { id: "C-1", groupId: "C", date: "2026-06-13", time: "19:00", teamA: "Brasil",          teamB: "Marrocos"         },
  { id: "C-2", groupId: "C", date: "2026-06-13", time: "22:00", teamA: "Haiti",           teamB: "Escocia"          },
  { id: "C-3", groupId: "C", date: "2026-06-17", time: "16:00", teamA: "Brasil",          teamB: "Haiti"            },
  { id: "C-4", groupId: "C", date: "2026-06-17", time: "20:00", teamA: "Marrocos",        teamB: "Escocia"          },
  { id: "C-5", groupId: "C", date: "2026-06-21", time: "20:00", teamA: "Brasil",          teamB: "Escocia"          },
  { id: "C-6", groupId: "C", date: "2026-06-21", time: "20:00", teamA: "Marrocos",        teamB: "Haiti"            },
  // ── Grupo D ────────────────────────────────────────────
  { id: "D-1", groupId: "D", date: "2026-06-12", time: "22:00", teamA: "Estados Unidos",  teamB: "Paraguai"         },
  { id: "D-2", groupId: "D", date: "2026-06-14", time: "01:00", teamA: "Australia",       teamB: "Turquia"          },
  { id: "D-3", groupId: "D", date: "2026-06-16", time: "19:00", teamA: "Estados Unidos",  teamB: "Australia"        },
  { id: "D-4", groupId: "D", date: "2026-06-18", time: "16:00", teamA: "Paraguai",        teamB: "Turquia"          },
  { id: "D-5", groupId: "D", date: "2026-06-20", time: "20:00", teamA: "Estados Unidos",  teamB: "Turquia"          },
  { id: "D-6", groupId: "D", date: "2026-06-20", time: "20:00", teamA: "Paraguai",        teamB: "Australia"        },
  // ── Grupo E ────────────────────────────────────────────
  { id: "E-1", groupId: "E", date: "2026-06-14", time: "14:00", teamA: "Alemanha",        teamB: "Curacao"          },
  { id: "E-2", groupId: "E", date: "2026-06-14", time: "20:00", teamA: "Costa do Marfim", teamB: "Equador"          },
  { id: "E-3", groupId: "E", date: "2026-06-18", time: "16:00", teamA: "Alemanha",        teamB: "Costa do Marfim"  },
  { id: "E-4", groupId: "E", date: "2026-06-18", time: "22:00", teamA: "Curacao",         teamB: "Equador"          },
  { id: "E-5", groupId: "E", date: "2026-06-22", time: "20:00", teamA: "Alemanha",        teamB: "Equador"          },
  { id: "E-6", groupId: "E", date: "2026-06-22", time: "20:00", teamA: "Curacao",         teamB: "Costa do Marfim"  },
  // ── Grupo F ────────────────────────────────────────────
  { id: "F-1", groupId: "F", date: "2026-06-14", time: "17:00", teamA: "Holanda",         teamB: "Japao"            },
  { id: "F-2", groupId: "F", date: "2026-06-14", time: "23:00", teamA: "Suecia",          teamB: "Tunisia"          },
  { id: "F-3", groupId: "F", date: "2026-06-18", time: "17:00", teamA: "Holanda",         teamB: "Suecia"           },
  { id: "F-4", groupId: "F", date: "2026-06-18", time: "23:00", teamA: "Japao",           teamB: "Tunisia"          },
  { id: "F-5", groupId: "F", date: "2026-06-22", time: "20:00", teamA: "Holanda",         teamB: "Tunisia"          },
  { id: "F-6", groupId: "F", date: "2026-06-22", time: "20:00", teamA: "Japao",           teamB: "Suecia"           },
  // ── Grupo G ────────────────────────────────────────────
  { id: "G-1", groupId: "G", date: "2026-06-15", time: "16:00", teamA: "Belgica",         teamB: "Egito"            },
  { id: "G-2", groupId: "G", date: "2026-06-15", time: "22:00", teamA: "Ira",             teamB: "Nova Zelandia"    },
  { id: "G-3", groupId: "G", date: "2026-06-19", time: "16:00", teamA: "Belgica",         teamB: "Ira"              },
  { id: "G-4", groupId: "G", date: "2026-06-19", time: "22:00", teamA: "Egito",           teamB: "Nova Zelandia"    },
  { id: "G-5", groupId: "G", date: "2026-06-23", time: "20:00", teamA: "Belgica",         teamB: "Nova Zelandia"    },
  { id: "G-6", groupId: "G", date: "2026-06-23", time: "20:00", teamA: "Egito",           teamB: "Ira"              },
  // ── Grupo H ────────────────────────────────────────────
  { id: "H-1", groupId: "H", date: "2026-06-15", time: "13:00", teamA: "Espanha",         teamB: "Cabo Verde"       },
  { id: "H-2", groupId: "H", date: "2026-06-15", time: "19:00", teamA: "Arabia Saudita",  teamB: "Uruguai"          },
  { id: "H-3", groupId: "H", date: "2026-06-19", time: "13:00", teamA: "Espanha",         teamB: "Arabia Saudita"   },
  { id: "H-4", groupId: "H", date: "2026-06-19", time: "19:00", teamA: "Cabo Verde",      teamB: "Uruguai"          },
  { id: "H-5", groupId: "H", date: "2026-06-23", time: "20:00", teamA: "Espanha",         teamB: "Uruguai"          },
  { id: "H-6", groupId: "H", date: "2026-06-23", time: "20:00", teamA: "Cabo Verde",      teamB: "Arabia Saudita"   },
  // ── Grupo I ────────────────────────────────────────────
  { id: "I-1", groupId: "I", date: "2026-06-16", time: "16:00", teamA: "Franca",          teamB: "Senegal"          },
  { id: "I-2", groupId: "I", date: "2026-06-16", time: "19:00", teamA: "Iraque",          teamB: "Noruega"          },
  { id: "I-3", groupId: "I", date: "2026-06-20", time: "16:00", teamA: "Franca",          teamB: "Iraque"           },
  { id: "I-4", groupId: "I", date: "2026-06-20", time: "19:00", teamA: "Senegal",         teamB: "Noruega"          },
  { id: "I-5", groupId: "I", date: "2026-06-24", time: "20:00", teamA: "Franca",          teamB: "Noruega"          },
  { id: "I-6", groupId: "I", date: "2026-06-24", time: "20:00", teamA: "Senegal",         teamB: "Iraque"           },
  // ── Grupo J ────────────────────────────────────────────
  { id: "J-1", groupId: "J", date: "2026-06-16", time: "22:00", teamA: "Argentina",       teamB: "Argelia"          },
  { id: "J-2", groupId: "J", date: "2026-06-17", time: "01:00", teamA: "Austria",         teamB: "Jordania"         },
  { id: "J-3", groupId: "J", date: "2026-06-20", time: "22:00", teamA: "Argentina",       teamB: "Austria"          },
  { id: "J-4", groupId: "J", date: "2026-06-21", time: "01:00", teamA: "Argelia",         teamB: "Jordania"         },
  { id: "J-5", groupId: "J", date: "2026-06-24", time: "20:00", teamA: "Argentina",       teamB: "Jordania"         },
  { id: "J-6", groupId: "J", date: "2026-06-24", time: "20:00", teamA: "Argelia",         teamB: "Austria"          },
  // ── Grupo K ────────────────────────────────────────────
  { id: "K-1", groupId: "K", date: "2026-06-17", time: "14:00", teamA: "Portugal",        teamB: "RD Congo"         },
  { id: "K-2", groupId: "K", date: "2026-06-17", time: "23:00", teamA: "Uzbequistao",     teamB: "Colombia"         },
  { id: "K-3", groupId: "K", date: "2026-06-21", time: "16:00", teamA: "Portugal",        teamB: "Uzbequistao"      },
  { id: "K-4", groupId: "K", date: "2026-06-21", time: "20:00", teamA: "RD Congo",        teamB: "Colombia"         },
  { id: "K-5", groupId: "K", date: "2026-06-25", time: "20:00", teamA: "Portugal",        teamB: "Colombia"         },
  { id: "K-6", groupId: "K", date: "2026-06-25", time: "20:00", teamA: "RD Congo",        teamB: "Uzbequistao"      },
  // ── Grupo L ────────────────────────────────────────────
  { id: "L-1", groupId: "L", date: "2026-06-17", time: "17:00", teamA: "Inglaterra",      teamB: "Croacia"          },
  { id: "L-2", groupId: "L", date: "2026-06-17", time: "20:00", teamA: "Gana",            teamB: "Panama"           },
  { id: "L-3", groupId: "L", date: "2026-06-21", time: "17:00", teamA: "Inglaterra",      teamB: "Gana"             },
  { id: "L-4", groupId: "L", date: "2026-06-21", time: "20:00", teamA: "Croacia",         teamB: "Panama"           },
  { id: "L-5", groupId: "L", date: "2026-06-25", time: "20:00", teamA: "Inglaterra",      teamB: "Panama"           },
  { id: "L-6", groupId: "L", date: "2026-06-25", time: "20:00", teamA: "Croacia",         teamB: "Gana"             }
].map((m) => ({ ...m, scoreA: null, scoreB: null }));

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
    matchPredictions: []
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
  store.matchPredictions = Array.isArray(store.matchPredictions) ? store.matchPredictions : [];

  const hasOldPreds = store.matchPredictions.some(
    (p) => (p.scoreA !== undefined || p.scoreB !== undefined) && p.choice === undefined
  );
  const legacyQualifiedKey = "qualified" + "Predictions";
  const hasOldQualified = Object.prototype.hasOwnProperty.call(store, legacyQualifiedKey);

  if (hasOldPreds || hasOldQualified) {
    backupStore();
    store.matchPredictions = store.matchPredictions.filter((p) => p.choice !== undefined);
    delete store[legacyQualifiedKey];
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

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function sanitizeParticipant(p) {
  const { passwordHash, ...rest } = p;
  return rest;
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
        if (!guess) return total;
        const realOutcome = matchOutcome(match.scoreA, match.scoreB);
        if (guess.homeScore !== undefined && guess.homeScore !== null) {
          if (guess.homeScore === match.scoreA && guess.awayScore === match.scoreB) return total + 3;
          if (matchOutcome(guess.homeScore, guess.awayScore) === realOutcome) return total + 1;
          return total;
        }
        return guess.choice === realOutcome ? total + 1 : total;
      }, 0);

      return {
        position: 0,
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
    participant: sanitizeParticipant(participant),
    closed: isClosed(store.settings),
    groups: store.groups,
    matches: store.matches,
    matchPredictions: store.matchPredictions.filter((item) => item.participantId === participantId)
  };
}

function setParticipantPredictions(store, participantId, body) {
  const validMatchIds = new Set(store.matches.map((match) => match.id));

  const matchPredictions = Array.isArray(body.matchPredictions) ? body.matchPredictions : [];

  store.matchPredictions = store.matchPredictions.filter((item) => item.participantId !== participantId);
  matchPredictions.forEach((item) => {
    if (!validMatchIds.has(item.matchId)) return;
    const home = parseInt(item.homeScore);
    const away = parseInt(item.awayScore);
    if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
      store.matchPredictions.push({ participantId, matchId: item.matchId, homeScore: home, awayScore: away });
    }
  });
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
    const password = String(body.password || "").trim();
    if (name.length < 3 || phone.length < 8) {
      sendJson(response, 400, { error: "Informe nome completo e celular com WhatsApp." });
      return;
    }
    const duplicate = store.participants.find((p) => p.phone === phone);
    if (duplicate) {
      sendJson(response, 409, { error: "Celular ja cadastrado. Use 'Entrar' para acessar." });
      return;
    }
    const participant = {
      id: crypto.randomUUID(),
      registrationNumber: store.nextRegistration++,
      name,
      phone,
      passwordHash: password.length >= 4 ? hashPassword(password) : null,
      createdAt: new Date().toISOString()
    };
    store.participants.push(participant);
    writeStore(store);
    sendJson(response, 201, sanitizeParticipant(participant));
    return;
  }

  if (request.method === "POST" && pathname === "/api/participants/login") {
    const body = await getBody(request);
    const phone = normalizePhone(body.phone);
    const password = String(body.password || "").trim();
    if (phone.length < 8) {
      sendJson(response, 400, { error: "Informe o celular com DDD." });
      return;
    }
    const found = store.participants.find((p) => p.phone === phone);
    if (!found) {
      sendJson(response, 404, { error: "Celular nao encontrado. Verifique o numero ou crie uma conta." });
      return;
    }
    if (found.passwordHash && hashPassword(password) !== found.passwordHash) {
      sendJson(response, 401, { error: "Senha incorreta." });
      return;
    }
    sendJson(response, 200, sanitizeParticipant(found));
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
    writeStore(store);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/ranking") {
    const ranking = calculateRanking(store).map(({ position, name, points }) => ({ position, name, points }));
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
    if (requestUrl.pathname === "/icon-192.png") {
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      response.end(icon192png);
      return;
    }
    if (requestUrl.pathname === "/icon-512.png") {
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      response.end(icon512png);
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
