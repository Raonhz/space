/**
 * 우주 상식 피드 서비스
 * spaceFacts.json 데이터를 기반으로 ISS 위치/시간대에 맞는 팩트를 선별하여 제공합니다.
 */
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

// 이미 표시된 팩트 ID를 추적하여 중복 최소화
let shownIds: Set<string> = new Set();

/**
 * ISS 상태에 맞는 컨텍스트 태그를 결정합니다.
 */
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

  // 지역 태그 결정
  if (lat > 60 || lat < -60) tags.push('polar');
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) tags.push('africa');
  if (lat >= 10 && lat <= 55 && lon >= 60 && lon <= 150) tags.push('asia');
  if (lat >= -60 && lat <= 15 && lon >= -82 && lon <= -34) tags.push('south_america');

  return tags;
}

/**
 * 주어진 컨텍스트에 맞는 팩트를 필터링하고,
 * 중복을 최소화하면서 랜덤으로 N개를 선택합니다.
 */
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

  // 컨텍스트 매칭 점수 계산
  const scored = facts.map(fact => {
    const matchCount = fact.context.filter(c => contextTags.includes(c)).length;
    const alreadyShown = shownIds.has(fact.id) ? -2 : 0;
    return { fact, score: matchCount + alreadyShown };
  });

  // 점수 내림차순 정렬 후 상위에서 약간의 랜덤성 추가
  scored.sort((a, b) => b.score - a.score);

  // 상위 후보군에서 랜덤 선택 (상위 30%에서)
  const poolSize = Math.max(count * 4, Math.floor(scored.length * 0.3));
  const pool = scored.slice(0, poolSize);

  // Fisher-Yates 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, count).map(s => s.fact);

  // 표시된 ID 기록
  selected.forEach(f => shownIds.add(f.id));

  // 전체 팩트의 70% 이상 표시되었으면 리셋
  if (shownIds.size > facts.length * 0.7) {
    shownIds = new Set();
  }

  return selected;
}

/**
 * 카테고리별 한국어 라벨
 */
export const categoryLabels: Record<string, string> = {
  iss: 'ISS',
  solar_system: 'Solar System',
  earth_observation: 'Earth',
  space_history: 'History',
  astronomy: 'Deep Space',
  astronaut_life: 'Crew Life',
  space_tech: 'Technology',
};

/**
 * 총 팩트 수 반환
 */
export function getTotalFactCount(): number {
  return facts.length;
}
