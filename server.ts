import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  runGuardrail,
  planDayGraph,
  detectPeopleWithArgon,
  criticCharacterSpec,
  generateLandmark,
} from './server/geminiClient.ts';
import { computeWalkingRoute } from './server/routesApi.ts';
import { PlanetSpec, PlanetSpecSchema } from './src/types.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory planets store for fast saving & gallery reload
const savedPlanets = new Map<string, PlanetSpec>();

// 1. Guardrail Endpoint
app.post('/api/pipeline/guardrail', async (req: Request, res: Response) => {
  try {
    const { text, photosCount } = req.body;
    const result = await runGuardrail(text || '', Number(photosCount) || 0);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Day Planner Endpoint (Argon)
app.post('/api/pipeline/plan', async (req: Request, res: Response) => {
  try {
    const { text, photos } = req.body;
    const result = await planDayGraph(text || '', photos || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. Argon Strict Human Figure & Bounding Box Detection Endpoint
app.post('/api/pipeline/detect-people', async (req: Request, res: Response) => {
  try {
    const { photos, people } = req.body;
    const result = await detectPeopleWithArgon(photos || [], people || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Character Critic Endpoint (Argon)
app.post('/api/pipeline/critic-character', async (req: Request, res: Response) => {
  try {
    const { spec, context } = req.body;
    const result = await criticCharacterSpec(spec, context);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Landmark Forge Endpoint (Argon)
app.post('/api/pipeline/landmark', async (req: Request, res: Response) => {
  try {
    const { name, nameKr, momentId, description } = req.body;
    const result = await generateLandmark(name, nameKr, momentId, description || '');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Walking Route Endpoint (Google Routes API / Grid Fallback)
app.post('/api/pipeline/routes', async (req: Request, res: Response) => {
  try {
    const { day, moments } = req.body;
    const result = await computeWalkingRoute(Number(day) || 1, moments || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Demo fetch endpoint
app.get('/api/demo/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const demoFile = id === 'trip_anam_hyehwa' ? 'trip_anam_hyehwa.json' : 'anam_day.json';
  const filePath = path.resolve(process.cwd(), 'public', 'demo', demoFile);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.json(JSON.parse(data));
      return;
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to read demo file' });
      return;
    }
  }
  res.status(404).json({ error: 'Demo not found' });
});

// 7. Save & Retrieve Planets
app.get('/api/planets', (_req: Request, res: Response) => {
  const list = Array.from(savedPlanets.values()).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    momentsCount: p.territories.reduce((acc, t) => acc + t.momentIds.length, 0),
    charactersCount: p.characters.length,
    landmarksCount: p.landmarks.length,
  }));
  res.json({ planets: list });
});

app.post('/api/planets', (req: Request, res: Response) => {
  try {
    const parsed = PlanetSpecSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid PlanetSpec', issues: parsed.error.issues });
      return;
    }
    savedPlanets.set(parsed.data.id, parsed.data);
    res.json({ success: true, id: parsed.data.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/planets/:id', (req: Request, res: Response) => {
  const planet = savedPlanets.get(req.params.id);
  if (!planet) {
    res.status(404).json({ error: 'Planet not found' });
    return;
  }
  res.json(planet);
});

// Mount Vite or static dist
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[My Planet] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
