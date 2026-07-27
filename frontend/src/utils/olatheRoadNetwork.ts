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
  // A single segment is only OK as a short on-road hop — long 2-point chords are broken.
  if (route.length === 2) {
    const span = haversineMeters(route[0].lat, route[0].lng, route[1].lat, route[1].lng);
    return span > 8 && span < 80;
  }
  // Reject routes that contain an unrealistically long jump between waypoints.
  for (let i = 1; i < route.length; i++) {
    const seg = haversineMeters(
      route[i - 1].lat,
      route[i - 1].lng,
      route[i].lat,
      route[i].lng
    );
    if (seg > 450) return false;
  }
  return true;
}

/** Bucket size for the node lookup grid (~110 m). */
const NODE_GRID_DEG = 0.001;
const NODE_GRID_MAX_RING = 20;
const ASTAR_MAX_VISITS = 40000;
const ROUTE_CACHE_MAX = 256;
/**
 * Greedy weight on the A* heuristic. City grids have huge numbers of equal-cost paths, so an
 * exact heuristic explores most of the map; overweighting keeps searches to a narrow corridor
 * at the cost of a slightly-longer road path, which is invisible in a chase.
 */
const HEURISTIC_WEIGHT = 1.4;

let nodeGrid: Map<string, number[]> | null = null;
let nodeGridOwner: RoadNetwork | null = null;
let routeCache = new Map<string, RoadPoint[]>();

function gridKey(latCell: number, lngCell: number): string {
  return `${latCell}:${lngCell}`;
}

/** Bucket nodes by cell so nearest-node lookups don't scan the whole city. */
function ensureNodeGrid(network: RoadNetwork): Map<string, number[]> {
  if (nodeGrid && nodeGridOwner === network) return nodeGrid;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < network.nodes.length; i++) {
    const n = network.nodes[i];
    const key = gridKey(Math.floor(n.lat / NODE_GRID_DEG), Math.floor(n.lng / NODE_GRID_DEG));
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  nodeGrid = grid;
  nodeGridOwner = network;
  routeCache = new Map();
  return grid;
}

function scanAllNodes(
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

function nearestRoadNodeCandidates(
  network: RoadNetwork,
  point: RoadPoint,
  limit: number
): Array<{ index: number; dist: number }> {
  if (!network.nodes.length) return [];
  const grid = ensureNodeGrid(network);
  const latCell = Math.floor(point.lat / NODE_GRID_DEG);
  const lngCell = Math.floor(point.lng / NODE_GRID_DEG);
  const found: Array<{ index: number; dist: number }> = [];
  // Narrowest cell edge in meters — anything outside the searched rings is at least this far.
  const cellSpanM = 111320 * NODE_GRID_DEG * Math.cos(point.lat * (Math.PI / 180));
  let bestDist = Infinity;

  for (let ring = 0; ring <= NODE_GRID_MAX_RING; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        // Only walk the new cells added by this ring.
        if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const bucket = grid.get(gridKey(latCell + dy, lngCell + dx));
        if (!bucket) continue;
        for (const index of bucket) {
          const n = network.nodes[index];
          const dist = haversineMeters(point.lat, point.lng, n.lat, n.lng);
          if (dist < bestDist) bestDist = dist;
          found.push({ index, dist });
        }
      }
    }
    // Stop once no unsearched cell could hold anything closer than what we already have.
    if (found.length >= limit && bestDist <= ring * cellSpanM) break;
  }

  if (!found.length) return scanAllNodes(network, point, limit);
  found.sort((a, b) => a.dist - b.dist);
  return found.slice(0, limit);
}

/** Nearest road node + distance in meters. */
export function nearestRoadNode(network: RoadNetwork, point: RoadPoint): { index: number; dist: number } {
  const [best] = nearestRoadNodeCandidates(network, point, 1);
  return best ?? { index: 0, dist: Infinity };
}

export function snapToNearestRoad(network: RoadNetwork, point: RoadPoint): RoadPoint {
  const { index } = nearestRoadNode(network, point);
  return { ...network.nodes[index] };
}

export interface RoadSnap {
  /** Closest point on a road centerline. */
  point: RoadPoint;
  /** Meters from the queried point to that centerline. */
  distM: number;
}

/** Perpendicular projection of `point` onto segment a→b, clamped to the segment. */
function projectOnSegment(point: RoadPoint, a: RoadPoint, b: RoadPoint): RoadPoint {
  // Local flat projection — accurate well below the scale of a city block.
  const scale = Math.cos(a.lat * (Math.PI / 180));
  const ax = a.lng * scale;
  const ay = a.lat;
  const bx = b.lng * scale;
  const by = b.lat;
  const px = point.lng * scale;
  const py = point.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...a };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { lat: ay + dy * t, lng: (ax + dx * t) / scale };
}

/**
 * Closest point on any nearby road centerline, not just the closest road node. Node spacing
 * follows OSM geometry vertices, so long straight roads have gaps of 100 m or more between
 * nodes — snapping to nodes alone would call a tap in the middle of a street "off road".
 */
export function snapToRoadSegment(network: RoadNetwork, point: RoadPoint): RoadSnap | null {
  const candidates = nearestRoadNodeCandidates(network, point, 8);
  if (!candidates.length) return null;

  let best: RoadSnap | null = null;
  const consider = (a: RoadPoint, b: RoadPoint) => {
    const proj = projectOnSegment(point, a, b);
    const distM = haversineMeters(point.lat, point.lng, proj.lat, proj.lng);
    if (!best || distM < best.distM) best = { point: proj, distM };
  };

  for (const candidate of candidates) {
    const node = network.nodes[candidate.index];
    if (!best || candidate.dist < best.distM) best = { point: { ...node }, distM: candidate.dist };
    for (const edge of network.adjacency.get(candidate.index) || []) {
      consider(node, network.nodes[edge.to]);
    }
  }

  return best;
}

/**
 * Road path with no plausibility filtering. Every vertex is a connected road node, so this is
 * always road-legal; use it when the caller already knows both ends sit on the network and a
 * short two-node hop is a valid answer.
 */
export function buildRoadNodePath(network: RoadNetwork, start: RoadPoint, dest: RoadPoint): RoadPoint[] {
  return findBestRoadPath(network, start, dest) ?? [];
}

/** Binary min-heap keyed by f-score — replaces sorting the open set every pop. */
class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): number {
    const topId = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.keys.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.keys.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(smallest, i);
        i = smallest;
      }
    }
    return topId;
  }

  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

interface SearchScratch {
  size: number;
  cost: Float64Array;
  cameFrom: Int32Array;
  closed: Uint8Array;
}

let scratch: SearchScratch | null = null;

function scratchFor(size: number): SearchScratch {
  if (!scratch || scratch.size !== size) {
    scratch = {
      size,
      cost: new Float64Array(size),
      cameFrom: new Int32Array(size),
      closed: new Uint8Array(size),
    };
  }
  scratch.cost.fill(Infinity);
  scratch.cameFrom.fill(-1);
  scratch.closed.fill(0);
  return scratch;
}

/** A* over the road graph — straight-line heuristic keeps routes short and direct. */
function findNodePath(network: RoadNetwork, startIdx: number, endIdx: number): number[] | null {
  if (startIdx === endIdx) return [startIdx];
  const size = network.nodes.length;
  if (startIdx >= size || endIdx >= size) return null;

  const { cost, cameFrom, closed } = scratchFor(size);
  const goal = network.nodes[endIdx];
  const heuristic = (idx: number) => {
    const n = network.nodes[idx];
    return haversineMeters(n.lat, n.lng, goal.lat, goal.lng) * HEURISTIC_WEIGHT;
  };

  cost[startIdx] = 0;
  const open = new MinHeap();
  open.push(startIdx, heuristic(startIdx));

  let visits = 0;
  let reached = false;
  while (open.size > 0 && visits < ASTAR_MAX_VISITS) {
    const u = open.pop();
    if (closed[u]) continue;
    closed[u] = 1;
    visits++;
    if (u === endIdx) {
      reached = true;
      break;
    }
    for (const edge of network.adjacency.get(u) || []) {
      const alt = cost[u] + edge.weight;
      if (alt + 0.01 < cost[edge.to]) {
        cost[edge.to] = alt;
        cameFrom[edge.to] = u;
        open.push(edge.to, alt + heuristic(edge.to));
      }
    }
  }

  if (!reached) return null;

  const path: number[] = [];
  let cur = endIdx;
  let guard = 0;
  while (cur !== -1 && guard++ <= size) {
    path.unshift(cur);
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  return path[0] === startIdx && path.length >= 2 ? path : null;
}

function cachedNodePath(network: RoadNetwork, startIdx: number, endIdx: number): RoadPoint[] | null {
  const key = `${startIdx}>${endIdx}`;
  const hit = routeCache.get(key);
  if (hit) {
    // Refresh recency for the LRU.
    routeCache.delete(key);
    routeCache.set(key, hit);
    return hit.map((p) => ({ ...p }));
  }

  const path = findNodePath(network, startIdx, endIdx);
  if (!path) return null;
  const points = path.map((idx) => ({ ...network.nodes[idx] }));
  routeCache.set(key, points);
  if (routeCache.size > ROUTE_CACHE_MAX) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  return points.map((p) => ({ ...p }));
}

function findBestRoadPath(network: RoadNetwork, start: RoadPoint, dest: RoadPoint): RoadPoint[] | null {
  const startCandidates = nearestRoadNodeCandidates(network, start, 3);
  const destCandidates = nearestRoadNodeCandidates(network, dest, 3);
  if (!startCandidates.length || !destCandidates.length) return null;

  // One search on the closest snaps covers nearly every call; alternates only cover the
  // case where a snapped node sits on a disconnected stub.
  const direct = cachedNodePath(network, startCandidates[0].index, destCandidates[0].index);
  if (direct && direct.length >= 2) return direct;

  for (const s of startCandidates) {
    for (const d of destCandidates) {
      if (s === startCandidates[0] && d === destCandidates[0]) continue;
      const route = cachedNodePath(network, s.index, d.index);
      if (route && route.length >= 2) return route;
    }
  }

  return null;
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
