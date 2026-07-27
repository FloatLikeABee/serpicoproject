import {
  RoadNetwork,
  buildOsmRoadRoute,
  buildRoadNodePath,
  nearestRoadNode,
  snapToNearestRoad,
  snapToRoadSegment,
} from './olatheRoadNetwork';

/** Street grid inside the Olathe box: `size` x `size` intersections, ~55 m apart. */
function buildGridNetwork(size: number): RoadNetwork {
  const step = 0.0005;
  const nodes: Array<{ lat: number; lng: number }> = [];
  const adjacency = new Map<number, Array<{ to: number; weight: number }>>();
  const idx = (row: number, col: number) => row * size + col;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      nodes.push({ lat: 38.87 + row * step, lng: -94.83 + col * step });
      adjacency.set(idx(row, col), []);
    }
  }

  const link = (a: number, b: number) => {
    const weight = 55;
    adjacency.get(a)!.push({ to: b, weight });
    adjacency.get(b)!.push({ to: a, weight });
  };

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (col + 1 < size) link(idx(row, col), idx(row, col + 1));
      if (row + 1 < size) link(idx(row, col), idx(row + 1, col));
    }
  }

  return { nodes, adjacency };
}

describe('olathe road network', () => {
  const network = buildGridNetwork(60);

  it('snaps a point to its closest intersection', () => {
    const target = network.nodes[1234];
    const snapped = snapToNearestRoad(network, {
      lat: target.lat + 0.00005,
      lng: target.lng - 0.00005,
    });
    expect(snapped).toEqual(target);
    expect(nearestRoadNode(network, target).index).toBe(1234);
  });

  it('snaps to the centerline between intersections, not just to nodes', () => {
    const a = network.nodes[0];
    const b = network.nodes[1];
    // Mid-block, a few meters off the centerline: on the street, far from either node.
    const tap = { lat: (a.lat + b.lat) / 2 + 0.00002, lng: (a.lng + b.lng) / 2 };
    const snap = snapToRoadSegment(network, tap);

    expect(snap).not.toBeNull();
    expect(snap!.distM).toBeLessThan(5);
    expect(nearestRoadNode(network, tap).dist).toBeGreaterThan(20);
  });

  it('reports how far a tap sits from the nearest street', () => {
    const corner = network.nodes[0];
    // Deep inside a block, away from every centerline.
    const snap = snapToRoadSegment(network, { lat: corner.lat + 0.00025, lng: corner.lng + 0.00025 });

    expect(snap!.distM).toBeGreaterThan(15);
  });

  it('accepts a single long hop between intersections', () => {
    const a = { lat: 38.88, lng: -94.82 };
    const b = { lat: 38.88, lng: -94.8175 };
    const long: RoadNetwork = {
      nodes: [a, b],
      adjacency: new Map([
        [0, [{ to: 1, weight: 217 }]],
        [1, [{ to: 0, weight: 217 }]],
      ]),
    };

    // The plausibility filter distrusts long two-point routes; a drive order must not.
    expect(buildOsmRoadRoute(long, a, b)).toEqual([]);
    expect(buildRoadNodePath(long, a, b)).toEqual([a, b]);
  });

  it('routes corner to corner along connected roads', () => {
    const start = network.nodes[0];
    const dest = network.nodes[network.nodes.length - 1];
    const route = buildOsmRoadRoute(network, start, dest);

    expect(route.length).toBeGreaterThan(2);
    expect(route[0]).toEqual(start);
    expect(route[route.length - 1]).toEqual(dest);
    // A grid has no diagonals, so the shortest path is one leg per axis plus the origin.
    expect(route.length).toBe(2 * 59 + 1);
  });

  it('computes many chase re-aims well inside one animation frame', () => {
    const start = network.nodes[0];
    const startedAt = Date.now();
    for (let i = 0; i < 40; i++) {
      // Distinct destinations so the route cache cannot mask the search cost.
      const route = buildOsmRoadRoute(network, start, network.nodes[900 + i]);
      expect(route.length).toBeGreaterThan(1);
    }
    expect(Date.now() - startedAt).toBeLessThan(600);
  });

  it('returns nothing when the destination is on an unreachable island', () => {
    const island = buildGridNetwork(4);
    const islandNode = { lat: 38.9, lng: -94.79 };
    island.nodes.push(islandNode);
    island.adjacency.set(island.nodes.length - 1, []);

    expect(buildOsmRoadRoute(island, island.nodes[0], islandNode)).toEqual([]);
  });
});
