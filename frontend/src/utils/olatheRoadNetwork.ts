/** Olathe road network from OpenStreetMap — routes follow real map roads. */

export interface RoadPoint {
  lat: number;
  lng: number;
}

const BOUNDS = { latMin: 38.86, latMax: 38.91, lngMin: -94.85, lngMax: -94.78 };
const CACHE_KEY = 'serpico-olathe-roads-v2';
const NODE_PRECISION = 5;

export interface RoadNetwork {
  nodes: RoadPoint[];
  adjacency: Map<number, Array<{ to: number; weight: number }>>;
}

interface SerializedRoadNetwork {
  nodes: RoadPoint[];
  adjacency: Array<[number, Array<{ to: number; weight: number }>]>;
}

let cachedNetwork: RoadNetwork | null = null;
let loadPromise: Promise<RoadNetwork> | null = null;

function nodeKey(p: RoadPoint): string {
  return `${p.lat.toFixed(NODE_PRECISION)},${p.lng.toFixed(NODE_PRECISION)}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inBounds(p: RoadPoint) {
  return (
    p.lat >= BOUNDS.latMin &&
    p.lat <= BOUNDS.latMax &&
    p.lng >= BOUNDS.lngMin &&
    p.lng <= BOUNDS.lngMax
  );
}

function serializeNetwork(network: RoadNetwork): string {
  return JSON.stringify({
    nodes: network.nodes,
    adjacency: Array.from(network.adjacency.entries()),
  } satisfies SerializedRoadNetwork);
}

function deserializeNetwork(raw: string): RoadNetwork | null {
  try {
    const parsed = JSON.parse(raw) as SerializedRoadNetwork;
    if (!parsed.nodes?.length || !parsed.adjacency?.length) return null;
    const adjacency = new Map<number, Array<{ to: number; weight: number }>>(parsed.adjacency);
    if (adjacency.size < 10) return null;
    return { nodes: parsed.nodes, adjacency };
  } catch {
    return null;
  }
}

function addEdge(
  nodeIndex: Map<string, number>,
  nodes: RoadPoint[],
  adjacency: Map<number, Array<{ to: number; weight: number }>>,
  a: RoadPoint,
  b: RoadPoint
) {
  const keyA = nodeKey(a);
  const keyB = nodeKey(b);
  let idxA = nodeIndex.get(keyA);
  let idxB = nodeIndex.get(keyB);
  if (idxA === undefined) {
    idxA = nodes.length;
    nodes.push(a);
    nodeIndex.set(keyA, idxA);
    adjacency.set(idxA, []);
  }
  if (idxB === undefined) {
    idxB = nodes.length;
    nodes.push(b);
    nodeIndex.set(keyB, idxB);
    adjacency.set(idxB, []);
  }
  if (idxA === idxB) return;
  const weight = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  if (weight < 2) return;
  adjacency.get(idxA)!.push({ to: idxB, weight });
  adjacency.get(idxB)!.push({ to: idxA, weight });
}

function parseOverpassElements(elements: unknown[]): RoadNetwork {
  const nodes: RoadPoint[] = [];
  const nodeIndex = new Map<string, number>();
  const adjacency = new Map<number, Array<{ to: number; weight: number }>>();

  for (const raw of elements) {
    const way = raw as { type?: string; geometry?: Array<{ lat: number; lon: number }> };
    if (way.type !== 'way' || !way.geometry || way.geometry.length < 2) continue;
    for (let i = 1; i < way.geometry.length; i++) {
      const a = { lat: way.geometry[i - 1].lat, lng: way.geometry[i - 1].lon };
      const b = { lat: way.geometry[i].lat, lng: way.geometry[i].lon };
      if (!inBounds(a) && !inBounds(b)) continue;
      addEdge(nodeIndex, nodes, adjacency, a, b);
    }
  }

  return { nodes, adjacency };
}

async function fetchRoadNetwork(): Promise<RoadNetwork> {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = deserializeNetwork(stored);
      if (parsed && parsed.nodes.length > 50) return parsed;
    }
  } catch {
    /* ignore bad cache */
  }

  const query = `
    [out:json][timeout:30];
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"]
      (${BOUNDS.latMin},${BOUNDS.lngMin},${BOUNDS.latMax},${BOUNDS.lngMax});
    out geom;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  const data = await response.json();
  const network = parseOverpassElements(data.elements || []);
  if (network.nodes.length < 50) throw new Error('insufficient road data');

  try {
    sessionStorage.setItem(CACHE_KEY, serializeNetwork(network));
  } catch {
    /* quota */
  }
  return network;
}

export function getRoadNetwork(): RoadNetwork | null {
  return cachedNetwork;
}

export function ensureRoadNetwork(): Promise<RoadNetwork> {
  if (cachedNetwork) return Promise.resolve(cachedNetwork);
  if (!loadPromise) {
    loadPromise = fetchRoadNetwork()
      .then((network) => {
        cachedNetwork = network;
        return network;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

/** True when a route has enough road waypoints (not a long straight-line shortcut). */
export function routeFollowsRoads(route: RoadPoint[]): boolean {
  if (route.length < 2) return false;
  if (route.length >= 3) return true;
  const span = haversineMeters(route[0].lat, route[0].lng, route[1].lat, route[1].lng);
  return span < 120;
}

/** Nearest road node + distance in meters. */
export function nearestRoadNode(network: RoadNetwork, point: RoadPoint): { index: number; dist: number } {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < network.nodes.length; i++) {
    const n = network.nodes[i];
    const d = haversineMeters(point.lat, point.lng, n.lat, n.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, dist: bestDist };
}

function nearestRoadNodeCandidates(
  network: RoadNetwork,
  point: RoadPoint,
  limit: number
): Array<{ index: number; dist: number }> {
  const ranked = network.nodes.map((n, index) => ({
    index,
    dist: haversineMeters(point.lat, point.lng, n.lat, n.lng),
  }));
  ranked.sort((a, b) => a.dist - b.dist);
  return ranked.slice(0, limit);
}

export function snapToNearestRoad(network: RoadNetwork, point: RoadPoint): RoadPoint {
  const { index } = nearestRoadNode(network, point);
  return { ...network.nodes[index] };
}

function dijkstra(network: RoadNetwork, startIdx: number, endIdx: number): number[] | null {
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  const queue: number[] = [startIdx];
  dist.set(startIdx, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const u = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === endIdx) break;

    for (const edge of network.adjacency.get(u) || []) {
      const alt = (dist.get(u) ?? Infinity) + edge.weight;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
        if (!visited.has(edge.to)) queue.push(edge.to);
      }
    }
  }

  if (!prev.has(endIdx) && startIdx !== endIdx) return null;

  const path: number[] = [];
  let cur: number | undefined = endIdx;
  while (cur !== undefined) {
    path.unshift(cur);
    if (cur === startIdx) break;
    cur = prev.get(cur);
  }
  return path.length > 0 ? path : null;
}

function pathLengthMeters(network: RoadNetwork, path: number[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const a = network.nodes[path[i - 1]];
    const b = network.nodes[path[i]];
    len += haversineMeters(a.lat, a.lng, b.lat, b.lng);
  }
  return len;
}

function findBestRoadPath(network: RoadNetwork, start: RoadPoint, dest: RoadPoint): RoadPoint[] | null {
  const startCandidates = nearestRoadNodeCandidates(network, start, 5);
  const destCandidates = nearestRoadNodeCandidates(network, dest, 5);

  let bestPath: number[] | null = null;
  let bestScore = Infinity;

  for (const s of startCandidates) {
    for (const d of destCandidates) {
      const path = dijkstra(network, s.index, d.index);
      if (!path || path.length < 2) continue;
      const score = pathLengthMeters(network, path) + s.dist + d.dist;
      if (score < bestScore) {
        bestScore = score;
        bestPath = path;
      }
    }
  }

  if (!bestPath) return null;

  const route = bestPath.map((idx) => network.nodes[idx]);
  const startSnap = snapToNearestRoad(network, start);
  const destSnap = snapToNearestRoad(network, dest);
  if (haversineMeters(route[0].lat, route[0].lng, start.lat, start.lng) > 3) {
    route.unshift(startSnap);
  }
  if (haversineMeters(route[route.length - 1].lat, route[route.length - 1].lng, dest.lat, dest.lng) > 3) {
    route.push(destSnap);
  }
  return route;
}

/** Build a route along OSM road centerlines. */
export function buildOsmRoadRoute(network: RoadNetwork, start: RoadPoint, dest: RoadPoint): RoadPoint[] {
  const route = findBestRoadPath(network, start, dest);
  if (route && routeFollowsRoads(route)) return route;
  return [];
}

export function headingAlongRoute(from: RoadPoint, to: RoadPoint): number {
  const rad = Math.PI / 180;
  const dLng = (to.lng - from.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
