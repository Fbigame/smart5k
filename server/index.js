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

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(recordsPath);
  } catch {
    await fs.writeFile(recordsPath, '[]', 'utf8');
  }
}

async function readRecords() {
  await ensureDataFile();
  const raw = await fs.readFile(recordsPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records) {
  await ensureDataFile();
  await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), 'utf8');
}

function getStats(records) {
  const hashSet = new Set(records.map(item => item.hash));
  return {
    totalClears: records.length,
    uniqueSolutions: hashSet.size,
  };
}

app.get('/api/stats', async (_req, res) => {
  try {
    const records = await readRecords();
    res.json(getStats(records));
  } catch {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.post('/api/clears', async (req, res) => {
  const record = req.body;
  if (!record || typeof record.hash !== 'string' || typeof record.level !== 'number') {
    res.status(400).json({ error: 'Invalid record payload' });
    return;
  }

  try {
    const records = await readRecords();
    const existed = records.some(item => item.hash === record.hash);

    if (!existed) {
      records.push(record);
      await writeRecords(records);
    }

    res.json({
      saved: !existed,
      stats: getStats(records),
    });
  } catch {
    res.status(500).json({ error: 'Failed to save clear record' });
  }
});

app.listen(port, async () => {
  await ensureDataFile();
  console.log(`API server running at http://localhost:${port}`);
});
