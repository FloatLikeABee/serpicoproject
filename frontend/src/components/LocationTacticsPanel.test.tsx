import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LocationTacticsPanel from './LocationTacticsPanel';
import { LandmarkKind, MapLandmark } from '../utils/pursuitSim';
import {
  LocationTacticsGame,
  beginTacticsRaid,
  reachableCells,
  startLocationTactics,
} from '../utils/locationTacticsSim';

function landmark(kind: LandmarkKind): MapLandmark {
  return { id: `lm-${kind}`, kind, name: `Rusty ${kind}`, lat: 38.88, lng: -94.82 };
}

function scenario(kind: LandmarkKind, mode: LocationTacticsGame['mode']): LocationTacticsGame {
  for (let day = 0; day < 60; day++) {
    const game = startLocationTactics(landmark(kind), new Date(Date.UTC(2026, 0, 1 + day)));
    if (game.mode === mode) return beginTacticsRaid(game);
  }
  throw new Error(`no ${mode} scenario for ${kind}`);
}

function renderPanel(game: LocationTacticsGame) {
  const onChange = jest.fn();
  const utils = render(
    <LocationTacticsPanel
      game={game}
      collapsed={false}
      onChange={onChange}
      onToggleCollapse={jest.fn()}
      onClose={jest.fn()}
    />
  );
  return { ...utils, onChange };
}

describe('LocationTacticsPanel', () => {
  it('shows the floor switcher, move budget and shot count', () => {
    const game = scenario('bar', 'chase');
    renderPanel(game);

    for (const floor of game.floors) {
      // Floor names also appear on officer rows, so just assert they are on screen.
      expect(screen.getAllByText(floor.name).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/moves left/i)).toBeInTheDocument();
    expect(screen.getByText(/^Shots \d+$/)).toBeInTheDocument();
    expect(screen.getByText(/End turn/i)).toBeInTheDocument();
  });

  it('shows the shared magazine in a gunfight', () => {
    const game = scenario('club', 'gunfight');
    renderPanel(game);
    expect(screen.getByText(/Ammo 30\/30/)).toBeInTheDocument();
  });

  it('switches the shown floor when a floor tab is tapped', () => {
    const game = scenario('factory', 'chase');
    const other = game.floors.find((f) => f.index !== game.viewFloor)!;
    const { onChange } = renderPanel(game);

    fireEvent.click(screen.getByText(other.name));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].viewFloor).toBe(other.index);
  });

  it('moves an officer when a reachable tile is tapped', () => {
    const game = scenario('bar', 'chase');
    const officer = game.units.find((u) => u.id === game.selectedUnitId)!;
    const { onChange } = renderPanel(game);

    const target = reachableCells(game, officer.id).find((c) => c.cost === 1)!;
    expect(target).toBeDefined();
    fireEvent.click(screen.getByLabelText(new RegExp(`\\b${target.x},${target.y}$`)));
    expect(onChange).toHaveBeenCalled();
    const next: LocationTacticsGame = onChange.mock.calls[0][0];
    const moved = next.units.find((u) => u.id === officer.id)!;
    expect(moved.moves).toBeLessThan(officer.moves);
  });

  it('renders the completed result panel', () => {
    const game: LocationTacticsGame = {
      ...scenario('bar', 'chase'),
      phase: 'completed',
      result: {
        outcome: 'partial_win',
        caught: 2,
        escaped: 1,
        totalPerps: 3,
        officersHurt: 1,
        turnsUsed: 9,
        score: 61,
        message: 'Partial hold — some made the street.',
      },
    };
    renderPanel(game);
    expect(screen.getByText(/Partial hold/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/3 caught/)).toBeInTheDocument();
  });

  it('collapses to a single summary bar', () => {
    const game = scenario('bar', 'chase');
    render(
      <LocationTacticsPanel
        game={game}
        collapsed
        onChange={jest.fn()}
        onToggleCollapse={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/Expand/i)).toBeInTheDocument();
    expect(screen.getByText(/loose/)).toBeInTheDocument();
  });

  it('fades tracers without crashing', () => {
    jest.useFakeTimers();
    const base = scenario('club', 'gunfight');
    const game: LocationTacticsGame = {
      ...base,
      tracers: [
        {
          id: 't1',
          floor: base.viewFloor,
          fromX: 2,
          fromY: 2,
          toX: 5,
          toY: 4,
          side: 'cop',
          hit: true,
          life: 1,
        },
      ],
    };
    const { onChange } = renderPanel(game);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].tracers[0].life).toBeLessThan(1);
    jest.useRealTimers();
  });
});
