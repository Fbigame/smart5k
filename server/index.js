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
const TOTAL_TRIANGLES = 81;
const SHAPE_COUNT = 12;
const TRIANGLES_PER_SHAPE = 6;
const DISABLED_CELL_IDS = new Set([0, 49, 64, 65, 66, 63, 78, 79, 80]);
const ALLOWED_CELL_IDS = new Set(
  Array.from({ length: TOTAL_TRIANGLES }, (_, index) => index).filter(index => !DISABLED_CELL_IDS.has(index))
);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function createEmptyStore() {
  return {
    totalClears: 0,
    solutions: [],
  };
}

function extractLayoutDetails(record) {
  const shapeLayouts = Array.isArray(record?.shapeLayouts)
    ? record.shapeLayouts.map(item => ({
        shapeId: Number(item?.shapeId) || 0,
        rotation: Number(item?.rotation) || 0,
        flipped: Boolean(item?.flipped),
        triangles: Array.isArray(item?.triangles)
          ? item.triangles.map(value => Number(value)).filter(Number.isFinite)
          : [],
      }))
    : [];

  const cellStacks = Array.isArray(record?.cellStacks)
    ? record.cellStacks.map(item => ({
        cellId: Number(item?.cellId) || 0,
        shapeIds: Array.isArray(item?.shapeIds)
          ? item.shapeIds.map(value => Number(value)).filter(Number.isFinite)
          : [],
      }))
    : [];

  return {
    shapeLayouts,
    cellStacks,
  };
}

function hashStringFNV1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getRowByTriangleId(triangleId) {
  return Math.floor(Math.sqrt(triangleId));
}

function mirrorTriangleIdHorizontally(triangleId) {
  const row = getRowByTriangleId(triangleId);
  const rowStart = row * row;
  const col = triangleId - rowStart;
  const mirroredCol = 2 * row - col;
  return rowStart + mirroredCol;
}

function computeCanonicalSolutionHash(layoutDetails) {
  const shapeLayouts = Array.isArray(layoutDetails?.shapeLayouts)
    ? layoutDetails.shapeLayouts
        .map(item => ({
          shapeId: Number(item?.shapeId) || 0,
          triangles: Array.isArray(item?.triangles)
            ? item.triangles.map(value => Number(value)).filter(Number.isFinite).sort((a, b) => a - b)
            : [],
        }))
        .sort((a, b) => a.shapeId - b.shapeId)
    : [];

  const cellStacks = Array.isArray(layoutDetails?.cellStacks)
    ? layoutDetails.cellStacks
        .map(item => ({
          cellId: Number(item?.cellId),
          shapeIds: Array.isArray(item?.shapeIds)
            ? item.shapeIds.map(value => Number(value)).filter(Number.isFinite)
            : [],
        }))
        .filter(item => Number.isFinite(item.cellId))
        .sort((a, b) => a.cellId - b.cellId)
    : [];

  const originalLayoutForHash = {
    shapeLayouts: shapeLayouts.map(item => ({
      shapeId: item.shapeId,
      triangles: [...item.triangles],
    })),
    cellStacks,
  };

  const mirroredLayoutForHash = {
    shapeLayouts: shapeLayouts.map(item => ({
      shapeId: item.shapeId,
      triangles: item.triangles.map(mirrorTriangleIdHorizontally).sort((a, b) => a - b),
    })),
    cellStacks: cellStacks
      .map(item => ({
        cellId: mirrorTriangleIdHorizontally(item.cellId),
        shapeIds: [...item.shapeIds],
      }))
      .sort((a, b) => a.cellId - b.cellId),
  };

  const signatureA = JSON.stringify(originalLayoutForHash);
  const signatureB = JSON.stringify(mirroredLayoutForHash);
  const canonicalSignature = signatureA < signatureB ? signatureA : signatureB;
  return hashStringFNV1a(canonicalSignature);
}

function validateClearLayout(layoutDetails) {
  const shapeLayouts = Array.isArray(layoutDetails?.shapeLayouts) ? layoutDetails.shapeLayouts : [];
  const cellStacks = Array.isArray(layoutDetails?.cellStacks) ? layoutDetails.cellStacks : [];

  if (shapeLayouts.length !== SHAPE_COUNT) {
    return { valid: false, reason: `shapeLayouts must contain exactly ${SHAPE_COUNT} items` };
  }

  if (cellStacks.length !== ALLOWED_CELL_IDS.size) {
    return { valid: false, reason: `cellStacks must contain exactly ${ALLOWED_CELL_IDS.size} filled cells` };
  }

  const shapeIdSet = new Set();
  const triangleOwnerMap = new Map();

  for (const item of shapeLayouts) {
    const shapeId = Number(item?.shapeId);
    if (!Number.isInteger(shapeId) || shapeId < 1 || shapeId > SHAPE_COUNT) {
      return { valid: false, reason: 'shapeId must be an integer in [1, 12]' };
    }

    if (shapeIdSet.has(shapeId)) {
      return { valid: false, reason: 'shapeId must be unique in shapeLayouts' };
    }
    shapeIdSet.add(shapeId);

    if (!Number.isInteger(Number(item?.rotation)) || Number(item?.rotation) < 0 || Number(item?.rotation) > 5) {
      return { valid: false, reason: 'rotation must be an integer in [0, 5]' };
    }

    if (typeof item?.flipped !== 'boolean') {
      return { valid: false, reason: 'flipped must be boolean' };
    }

    const triangles = Array.isArray(item?.triangles) ? item.triangles : [];
    if (triangles.length !== TRIANGLES_PER_SHAPE) {
      return { valid: false, reason: `shape ${shapeId} must have exactly ${TRIANGLES_PER_SHAPE} triangles` };
    }

    const perShapeTriangleSet = new Set();
    for (const rawTriangleId of triangles) {
      const triangleId = Number(rawTriangleId);
      if (!Number.isInteger(triangleId) || triangleId < 0 || triangleId >= TOTAL_TRIANGLES) {
        return { valid: false, reason: `triangleId ${rawTriangleId} is out of range` };
      }

      if (DISABLED_CELL_IDS.has(triangleId)) {
        return { valid: false, reason: `triangleId ${triangleId} is disabled` };
      }

      if (perShapeTriangleSet.has(triangleId)) {
        return { valid: false, reason: `shape ${shapeId} has duplicate triangleId ${triangleId}` };
      }
      perShapeTriangleSet.add(triangleId);

      if (triangleOwnerMap.has(triangleId)) {
        return { valid: false, reason: `triangleId ${triangleId} is assigned to multiple shapes` };
      }
      triangleOwnerMap.set(triangleId, shapeId);
    }
  }

  if (shapeIdSet.size !== SHAPE_COUNT) {
    return { valid: false, reason: 'all shapeIds 1..12 must be present exactly once' };
  }

  if (triangleOwnerMap.size !== ALLOWED_CELL_IDS.size) {
    return { valid: false, reason: `total unique triangles must be exactly ${ALLOWED_CELL_IDS.size}` };
  }

  for (const allowedId of ALLOWED_CELL_IDS) {
    if (!triangleOwnerMap.has(allowedId)) {
      return { valid: false, reason: `allowed triangleId ${allowedId} is missing` };
    }
  }

  const cellStackMap = new Map();
  for (const item of cellStacks) {
    const cellId = Number(item?.cellId);
    if (!Number.isInteger(cellId) || !ALLOWED_CELL_IDS.has(cellId)) {
      return { valid: false, reason: `cellId ${item?.cellId} is invalid or disabled` };
    }

    if (cellStackMap.has(cellId)) {
      return { valid: false, reason: `cellId ${cellId} appears multiple times in cellStacks` };
    }

    const shapeIds = Array.isArray(item?.shapeIds) ? item.shapeIds.map(value => Number(value)).filter(Number.isFinite) : [];
    if (shapeIds.length !== 1) {
      return { valid: false, reason: `cellId ${cellId} must have exactly one shapeId in final clear state` };
    }

    const stackShapeId = shapeIds[0];
    if (!Number.isInteger(stackShapeId) || stackShapeId < 1 || stackShapeId > SHAPE_COUNT) {
      return { valid: false, reason: `cellId ${cellId} has invalid shapeId` };
    }

    cellStackMap.set(cellId, stackShapeId);
  }

  if (cellStackMap.size !== ALLOWED_CELL_IDS.size) {
    return { valid: false, reason: `cellStacks must cover all ${ALLOWED_CELL_IDS.size} allowed cells` };
  }

  for (const allowedId of ALLOWED_CELL_IDS) {
    const ownerShapeId = triangleOwnerMap.get(allowedId);
    const stackedShapeId = cellStackMap.get(allowedId);
    if (ownerShapeId !== stackedShapeId) {
      return {
        valid: false,
        reason: `cellId ${allowedId} mismatch between shapeLayouts (${ownerShapeId}) and cellStacks (${stackedShapeId})`,
      };
    }
  }

  return { valid: true };
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
        const layoutDetails = extractLayoutDetails(item);
        grouped.set(item.hash, {
          hash: item.hash,
          firstSolvedAt: clearedAt,
          lastSolvedAt: clearedAt,
          solvers: 1,
          firstLayout: layoutDetails,
          latestLayout: layoutDetails,
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
          firstSolvedAt: typeof item.firstSolvedAt === 'string' ? item.firstSolvedAt : new Date().toISOString(),
          lastSolvedAt: typeof item.lastSolvedAt === 'string' ? item.lastSolvedAt : new Date().toISOString(),
          solvers: Math.max(1, Number(item.solvers) || 1),
          firstLayout: item.firstLayout ?? extractLayoutDetails(item.latestRecord ?? item),
          latestLayout: item.latestLayout ?? extractLayoutDetails(item.latestRecord ?? item),
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
      solvers: item.solvers,
      firstSolvedAt: item.firstSolvedAt,
      lastSolvedAt: item.lastSolvedAt,
    }));
}

function getSolutionDetail(store, hash) {
  const solutions = Array.isArray(store.solutions) ? store.solutions : [];
  const item = solutions.find(solution => solution.hash === hash);
  if (!item) return null;

  return {
    hash: item.hash,
    solvers: item.solvers,
    firstSolvedAt: item.firstSolvedAt,
    lastSolvedAt: item.lastSolvedAt,
    firstLayout: item.firstLayout ?? null,
    latestLayout: item.latestLayout ?? null,
  };
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

app.get('/api/solutions/:hash', async (req, res) => {
  try {
    const store = await readStore();
    const detail = getSolutionDetail(store, req.params.hash);
    if (!detail) {
      res.status(404).json({ error: 'Solution not found' });
      return;
    }
    res.json(detail);
  } catch {
    res.status(500).json({ error: 'Failed to load solution detail' });
  }
});

app.post('/api/clears', async (req, res) => {
  const record = req.body;
  if (!record || typeof record !== 'object') {
    res.status(400).json({ error: 'Invalid record payload' });
    return;
  }

  try {
    const store = await readStore();
    const nowIso = new Date().toISOString();
    const layoutDetails = extractLayoutDetails(record);
    const validationResult = validateClearLayout(layoutDetails);
    if (!validationResult.valid) {
      res.status(400).json({ error: 'Invalid clear layout', reason: validationResult.reason });
      return;
    }

    const computedHash = computeCanonicalSolutionHash(layoutDetails);
    const solutionHash = typeof computedHash === 'string' && computedHash.length > 0
      ? computedHash
      : (typeof record.hash === 'string' ? record.hash : '');

    if (!solutionHash) {
      res.status(400).json({ error: 'Invalid record payload' });
      return;
    }

    const solutions = Array.isArray(store.solutions) ? store.solutions : [];
    const existedIndex = solutions.findIndex(item => item.hash === solutionHash);

    if (existedIndex >= 0) {
      const current = solutions[existedIndex];
      solutions[existedIndex] = {
        ...current,
        solvers: (Number(current.solvers) || 0) + 1,
        lastSolvedAt: nowIso,
        firstLayout: current.firstLayout ?? layoutDetails,
        latestLayout: layoutDetails,
        latestRecord: record,
      };
    } else {
      solutions.push({
        hash: solutionHash,
        firstSolvedAt: nowIso,
        lastSolvedAt: nowIso,
        solvers: 1,
        firstLayout: layoutDetails,
        latestLayout: layoutDetails,
        latestRecord: record,
      });
    }

    store.totalClears = (Number(store.totalClears) || 0) + 1;
    store.solutions = solutions;
    await writeStore(store);

    const savedSolution = solutions.find(item => item.hash === solutionHash) ?? null;

    res.json({
      saved: existedIndex < 0,
      stats: getStats(store),
      solution: savedSolution
        ? {
            hash: savedSolution.hash,
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
