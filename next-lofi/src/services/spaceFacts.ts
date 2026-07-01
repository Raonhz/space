import spaceFacts from '../data/spaceFacts.json';

export interface SpaceFact {
  id: string;
  category: string;
  icon: string;
  title: string;
  title_en: string;
  text: string;
  text_en: string;
  source: string;
  context: string[];
}

const facts: SpaceFact[] = spaceFacts.facts as SpaceFact[];
let shownIds: Set<string> = new Set();

function resolveContextTags(params: {
  isEclipsed?: boolean;
  isOcean?: boolean;
  latitude?: number;
  longitude?: number;
  country?: string;
}): string[] {
  const tags: string[] = ['general'];

  if (params.isEclipsed) tags.push('night');
  else tags.push('day');

  if (params.isOcean) tags.push('ocean');

  const lat = params.latitude ?? 0;
  const lon = params.longitude ?? 0;

  if (lat > 60 || lat < -60) tags.push('polar');
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) tags.push('africa');
  if (lat >= 10 && lat <= 55 && lon >= 60 && lon <= 150) tags.push('asia');
  if (lat >= -60 && lat <= 15 && lon >= -82 && lon <= -34) tags.push('south_america');

  return tags;
}

export function getSpaceFacts(
  count: number = 3,
  params: {
    isEclipsed?: boolean;
    isOcean?: boolean;
    latitude?: number;
    longitude?: number;
    country?: string;
  } = {}
): SpaceFact[] {
  const contextTags = resolveContextTags(params);

  const scored = facts.map(fact => {
    const matchCount = fact.context.filter(c => contextTags.includes(c)).length;
    const alreadyShown = shownIds.has(fact.id) ? -2 : 0;
    return { fact, score: matchCount + alreadyShown };
  });

  scored.sort((a, b) => b.score - a.score);
  const poolSize = Math.max(count * 4, Math.floor(scored.length * 0.3));
  const pool = scored.slice(0, poolSize);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, count).map(s => s.fact);
  selected.forEach(f => shownIds.add(f.id));

  if (shownIds.size > facts.length * 0.7) {
    shownIds = new Set();
  }

  return selected;
}

export const categoryLabels: Record<string, string> = {
  iss: 'ISS',
  solar_system: 'Solar System',
  earth_observation: 'Earth',
  space_history: 'History',
  astronomy: 'Deep Space',
  astronaut_life: 'Crew Life',
  space_tech: 'Technology',
};

export function getTotalFactCount(): number {
  return facts.length;
}
