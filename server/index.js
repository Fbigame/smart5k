import cors from 'cors';
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;
const dataDir = path.join(__dirname, 'data');
const recordsPath = path.join(dataDir, 'clear-records.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function createEmptyStore() {
  return {
    totalClears: 0,
    solutions: [],
  };
}

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(recordsPath);
  } catch {
    await fs.writeFile(recordsPath, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
  }
}

function normalizeStore(rawParsed) {
  // Backward compatibility: legacy array of records -> grouped solutions store.
  if (Array.isArray(rawParsed)) {
    const grouped = new Map();
    for (const item of rawParsed) {
      if (!item || typeof item.hash !== 'string') continue;
      const existing = grouped.get(item.hash);
      const clearedAt = typeof item.clearedAt === 'string' ? item.clearedAt : new Date().toISOString();
      if (existing) {
        existing.solvers += 1;
        if (clearedAt < existing.firstSolvedAt) existing.firstSolvedAt = clearedAt;
        if (clearedAt > existing.lastSolvedAt) existing.lastSolvedAt = clearedAt;
      } else {
        grouped.set(item.hash, {
          hash: item.hash,
          level: Number(item.level) || 1,
          firstSolvedAt: clearedAt,
          lastSolvedAt: clearedAt,
          solvers: 1,
          latestRecord: item,
        });
      }
    }

    const solutions = [...grouped.values()];
    const totalClears = solutions.reduce((sum, item) => sum + item.solvers, 0);
    return { totalClears, solutions };
  }

  if (!rawParsed || typeof rawParsed !== 'object') {
    return createEmptyStore();
  }

  const totalClears = Number(rawParsed.totalClears) || 0;
  const solutions = Array.isArray(rawParsed.solutions)
    ? rawParsed.solutions
        .filter(item => item && typeof item.hash === 'string')
        .map(item => ({
          hash: item.hash,
          level: Number(item.level) || 1,
          firstSolvedAt: typeof item.firstSolvedAt === 'string' ? item.firstSolvedAt : new Date().toISOString(),
          lastSolvedAt: typeof item.lastSolvedAt === 'string' ? item.lastSolvedAt : new Date().toISOString(),
          solvers: Math.max(1, Number(item.solvers) || 1),
          latestRecord: item.latestRecord ?? null,
        }))
    : [];

  return {
    totalClears,
    solutions,
  };
}

async function readStore() {
  await ensureDataFile();
  const raw = await fs.readFile(recordsPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch {
    return createEmptyStore();
  }
}

async function writeStore(store) {
  await ensureDataFile();
  await fs.writeFile(recordsPath, JSON.stringify(store, null, 2), 'utf8');
}

function getStats(store) {
  const totalSolutions = Array.isArray(store.solutions) ? store.solutions.length : 0;
  return {
    totalClears: Number(store.totalClears) || 0,
    uniqueSolutions: totalSolutions,
    totalSolutions,
  };
}

function listSolutions(store) {
  const solutions = Array.isArray(store.solutions) ? store.solutions : [];
  return solutions
    .slice()
    .sort((a, b) => a.firstSolvedAt.localeCompare(b.firstSolvedAt) || b.solvers - a.solvers)
    .map(item => ({
      hash: item.hash,
      level: item.level,
      solvers: item.solvers,
      firstSolvedAt: item.firstSolvedAt,
      lastSolvedAt: item.lastSolvedAt,
    }));
}

app.get('/api/stats', async (_req, res) => {
  try {
    const store = await readStore();
    res.json(getStats(store));
  } catch {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.get('/api/solutions', async (_req, res) => {
  try {
    const store = await readStore();
    const pageRaw = Number(_req.query.page);
    const pageSizeRaw = Number(_req.query.pageSize);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(Math.max(Math.floor(pageSizeRaw), 1), 50)
      : 12;
    const allSolutions = listSolutions(store);
    const total = allSolutions.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const solutions = allSolutions.slice(start, start + pageSize);

    res.json({
      totalPeople: Number(store.totalClears) || 0,
      total,
      page: safePage,
      pageSize,
      totalPages,
      solutions,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load solutions' });
  }
});

app.post('/api/clears', async (req, res) => {
  const record = req.body;
  if (!record || typeof record.hash !== 'string' || typeof record.level !== 'number') {
    res.status(400).json({ error: 'Invalid record payload' });
    return;
  }

  try {
    const store = await readStore();
    const nowIso = new Date().toISOString();
    const solutions = Array.isArray(store.solutions) ? store.solutions : [];
    const existedIndex = solutions.findIndex(item => item.hash === record.hash);

    if (existedIndex >= 0) {
      const current = solutions[existedIndex];
      solutions[existedIndex] = {
        ...current,
        level: Number(record.level) || current.level,
        solvers: (Number(current.solvers) || 0) + 1,
        lastSolvedAt: nowIso,
        latestRecord: record,
      };
    } else {
      solutions.push({
        hash: record.hash,
        level: Number(record.level) || 1,
        firstSolvedAt: nowIso,
        lastSolvedAt: nowIso,
        solvers: 1,
        latestRecord: record,
      });
    }

    store.totalClears = (Number(store.totalClears) || 0) + 1;
    store.solutions = solutions;
    await writeStore(store);

    const savedSolution = solutions.find(item => item.hash === record.hash) ?? null;

    res.json({
      saved: existedIndex < 0,
      stats: getStats(store),
      solution: savedSolution
        ? {
            hash: savedSolution.hash,
            level: savedSolution.level,
            solvers: savedSolution.solvers,
            firstSolvedAt: savedSolution.firstSolvedAt,
            lastSolvedAt: savedSolution.lastSolvedAt,
          }
        : null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to save clear record' });
  }
});

app.listen(port, async () => {
  await ensureDataFile();
  console.log(`API server running at http://localhost:${port}`);
});
