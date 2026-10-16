import { z } from 'zod';

export const PhotoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  takenAt: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  thumbUrl: z.string(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const MoodSchema = z.enum([
  'happy',
  'relaxed',
  'excited',
  'calm',
  'sad',
  'surprised',
]);
export type Mood = z.infer<typeof MoodSchema>;

export const MomentSchema = z.object({
  id: z.string(),
  day: z.number().int().min(1),
  time: z.string(),
  place: z.string(),
  placeKr: z.string().optional(),
  district: z.string().optional(),
  signs: z.array(z.string()).optional(),
  lat: z.number(),
  lng: z.number(),
  latLngSource: z.enum(['gps', 'estimate']),
  photoIds: z.array(z.string()),
  people: z.array(z.string()),
  activity: z.string(),
  mood: MoodSchema,
  quote: z.string(),
  narrative: z.string().optional(),
});
export type Moment = z.infer<typeof MomentSchema>;

export const CropBoxSchema = z.object({
  photoId: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  aspectRatio: z.number().optional(),
  isBorderline: z.boolean().optional(),
  manuallyVerified: z.boolean().optional(),
  reason: z.string().optional(),
});
export type CropBox = z.infer<typeof CropBoxSchema>;

export const DetectionStatusSchema = z.enum([
  'verified_human',
  'borderline_needs_verify',
  'no_visual_person',
  'rejected_non_human',
]);
export type DetectionStatus = z.infer<typeof DetectionStatusSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  label: z.string(),
  isMe: z.boolean(),
  consent: z.boolean(),
  photoIds: z.array(z.string()),
  cropBoxes: z.array(CropBoxSchema).default([]),
  detectionConfidence: z.number().min(0).max(1).optional(),
  detectionStatus: DetectionStatusSchema.optional(),
  detectionReason: z.string().optional(),
});
export type Person = z.infer<typeof PersonSchema>;

export const DayGraphSchema = z.object({
  title: z.string().default('My Seoul Memory'),
  days: z.array(
    z.object({
      dayNumber: z.number().int().min(1),
      date: z.string(),
      title: z.string().optional(),
      moments: z.array(MomentSchema),
    })
  ),
  people: z.array(PersonSchema),
  landmarks: z.array(
    z.object({
      name: z.string(),
      nameKr: z.string().optional(),
      momentId: z.string(),
      description: z.string().optional(),
    })
  ),
  theme: z.object({
    palette: z.array(z.string()).length(6),
    timeOfDay: z.enum(['morning', 'afternoon', 'sunset', 'night']),
  }),
});
export type DayGraph = z.infer<typeof DayGraphSchema>;

export const AccessorySchema = z.enum([
  'glasses',
  'cap',
  'earrings',
  'bag',
  'scarf',
]);
export type Accessory = z.infer<typeof AccessorySchema>;

export const HairStyleSchema = z.enum([
  'short',
  'bob',
  'long',
  'ponytail',
  'bun',
  'curly',
]);
export type HairStyle = z.infer<typeof HairStyleSchema>;

export const CharacterSpecSchema = z.object({
  id: z.string(),
  personId: z.string(),
  name: z.string(),
  isMe: z.boolean(),
  basePreset: z.string(),
  hairStyle: HairStyleSchema.optional().default('short'),
  hairColor: z.string(),
  skinTone: z.string(),
  eyeColor: z.string(),
  topColor: z.string(),
  bottomColor: z.string(),
  shoesColor: z.string(),
  accessories: z.array(AccessorySchema),
  heightScale: z.number().min(0.85).max(1.15).default(1.0),
  defaultExpression: MoodSchema.default('happy'),
  avatarStyle: z.enum(['vrm', 'stylized']).default('stylized'),
  criticNotes: z.string().optional(),
  criticPassed: z.boolean().default(true),
});
export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;

export const LandmarkPartSchema = z.object({
  type: z.enum(['box', 'cylinder', 'roof', 'spire', 'arch', 'columns', 'sign', 'tree', 'lamp']),
  position: z.tuple([z.number(), z.number(), z.number()]),
  size: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  color: z.string(),
  material: z.enum(['matte', 'gloss', 'stone', 'wood', 'neon', 'foliage']).default('matte'),
});

export const PlaceArchetypeSchema = z.enum([
  'stream',
  'riverPark',
  'park',
  'street',
  'plaza',
  'bridge',
  'campusBuilding',
  'cafe',
  'hanokTemple',
  'market',
  'tower',
  'generic',
]);
export type PlaceArchetype = z.infer<typeof PlaceArchetypeSchema>;

export const ArchetypeParamsSchema = z.object({
  archetype: PlaceArchetypeSchema.default('generic'),
  length: z.number().default(10),
  width: z.number().default(6),
  bridges: z.number().optional().default(1),
  trees: z.number().optional().default(3),
  steppingStones: z.number().optional().default(0),
  palette: z.object({
    primary: z.string().default('#78716C'),
    secondary: z.string().default('#064E3B'),
    accent: z.string().default('#F59E0B'),
    ground: z.string().default('#E2E8F0'),
  }).default({
    primary: '#78716C',
    secondary: '#064E3B',
    accent: '#F59E0B',
    ground: '#E2E8F0',
  }),
  signText: z.string().optional(),
});
export type ArchetypeParams = z.infer<typeof ArchetypeParamsSchema>;

export const LandmarkSpecSchema = z.object({
  name: z.string(),
  nameKr: z.string().optional(),
  momentId: z.string(),
  archetype: PlaceArchetypeSchema.default('generic'),
  archetypeParams: ArchetypeParamsSchema.optional(),
  footprint: z.object({ width: z.number(), depth: z.number() }),
  parts: z.array(LandmarkPartSchema).default([]),
  signatureFeatures: z.array(z.string()).max(4).default([]),
  palette: z.object({
    wall: z.string().default('#78716C'),
    roof: z.string().default('#064E3B'),
    trim: z.string().default('#E7E5E4'),
    accent: z.string().optional(),
  }),
  code: z.string().optional(),
  verified: z.boolean().default(true),
  critique: z.string().optional(),
});
export type LandmarkSpec = z.infer<typeof LandmarkSpecSchema>;

export const RoutePointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const RouteSpecSchema = z.object({
  day: z.number().int().min(1),
  source: z.enum(['routes_api', 'grid']),
  points: z.array(RoutePointSchema),
  distanceMeters: z.number().optional(),
  durationSeconds: z.number().optional(),
});
export type RouteSpec = z.infer<typeof RouteSpecSchema>;

export const AchievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  unlockedAt: z.string().optional(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const PlanetSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  seed: z.number(),
  createdAt: z.string(),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radius: z.number().default(24),
  territories: z.array(
    z.object({
      day: z.number(),
      color: z.string(),
      momentIds: z.array(z.string()),
    })
  ),
  routes: z.array(RouteSpecSchema),
  characters: z.array(CharacterSpecSchema),
  specHashes: z.record(z.string(), z.string()),
  landmarks: z.array(LandmarkSpecSchema),
  achievements: z.array(AchievementSchema),
  theme: DayGraphSchema.shape.theme,
});
export type PlanetSpec = z.infer<typeof PlanetSpecSchema>;

export interface AgentLogEntry {
  id: string;
  step: string;
  model: string;
  thinkingLevel: 'low' | 'medium' | 'high' | 'minimal';
  attempt: number;
  durationMs: number;
  tokensUsed?: number;
  status: 'running' | 'pass' | 'fail' | 'repaired';
  details?: string;
  timestamp: string;
}

export interface VerificationCheck {
  id: string;
  name: string;
  category: 'schema' | 'geospatial' | 'evidence' | 'character' | 'security' | 'landmark';
  description: string;
  status: 'passed' | 'warning' | 'failed' | 'pending';
  attempts: number;
  details: string;
  lastRun: string;
}
