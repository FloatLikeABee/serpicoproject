import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { chaseGameAPI, ChaseGameSession } from '../../services/api';

type GamePhase = 'lobby' | 'playing' | 'evaluation';

const DIFFICULTIES = [
  { id: 'easy', label: 'Rookie', icon: '🎖️', desc: 'Extra hints, forgiving scoring' },
  { id: 'medium', label: 'Patrol', icon: '🚔', desc: 'Standard pursuit training' },
  { id: 'hard', label: 'SWAT', icon: '⚡', desc: 'Chaos mode — think fast!' },
];

const ChaseGame: React.FC = () => {
  const { theme } = useTheme();
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [difficulty, setDifficulty] = useState('medium');
  const [session, setSession] = useState<ChaseGameSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const muted = isDark ? 'text-gray-400' : 'text-gray-600';

  const startGame = async () => {
    setLoading(true);
    setError('');
    try {
      const { session: newSession } = await chaseGameAPI.start(difficulty);
      setSession(newSession);
      setPhase('playing');
      setAnswer('');
    } catch (err: unknown) {
      setError('Failed to start mission. Check backend connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!session || !answer.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { session: updated } = await chaseGameAPI.respond(session.id, answer.trim());
      setSession(updated);
      setAnswer('');
      if (updated.phase === 'evaluation') {
        setPhase('evaluation');
      }
    } catch (err: unknown) {
      setError('Failed to submit response. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setPhase('lobby');
    setSession(null);
    setAnswer('');
    setError('');
  };

  const progressPercent = session
    ? session.phase === 'evaluation'
      ? 100
      : Math.round(((session.turn - 1) / session.maxTurns) * 100)
    : 0;

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`p-3 sm:p-4 border-b flex-shrink-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-serpico-red dark:text-serpico-red-light flex items-center gap-2">
              <span>🏁</span> Chase Game
            </h1>
            <p className={`text-sm mt-0.5 ${muted}`}>
              Pursuit training sim — vehicle & foot scenarios powered by AI
            </p>
          </div>
          {phase !== 'lobby' && (
            <button
              onClick={resetGame}
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-lg border ${
                isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              New Mission
            </button>
          )}
        </div>

        {phase !== 'lobby' && session && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className={muted}>Mission progress</span>
              <span className="font-medium text-serpico-blue">
                {session.phase === 'evaluation' ? 'Debrief complete' : `Round ${session.turn} / ${session.maxTurns}`}
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-serpico-red to-serpico-blue transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ minHeight: 0 }}>
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Lobby */}
        {phase === 'lobby' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className={`p-5 rounded-2xl ${cardBg} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className="text-lg font-bold dark:text-white mb-2">Ready for pursuit training?</h2>
              <p className={`text-sm ${muted} mb-4`}>
                AI Game Master drops you into cinematic vehicle & foot pursuit scenarios.
                Make tactical calls, handle twists, then get scored against the operation codex and real specimen cases.
              </p>
              <ul className={`text-sm space-y-2 ${muted}`}>
                <li>🎬 AI-generated scenario + scene image</li>
                <li>🔄 Interactive what-if rounds</li>
                <li>📋 Scored against IACP & Olathe PD doctrine</li>
                <li>🏆 Earn ranks — Rookie to Pursuit Legend</li>
              </ul>
            </div>

            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Pick difficulty</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      difficulty === d.id
                        ? 'border-serpico-blue bg-serpico-blue/10'
                        : isDark
                        ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{d.icon}</span>
                    <p className="font-bold text-sm dark:text-white mt-1">{d.label}</p>
                    <p className={`text-xs ${muted}`}>{d.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-serpico-red to-serpico-blue text-white font-bold text-lg shadow-lg hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Generating mission...' : '🚨 Start Chase Game'}
            </button>
          </div>
        )}

        {/* Playing */}
        {phase === 'playing' && session?.scenario && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Scenario card */}
            <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {session.imageUrl && (
                <div className="relative aspect-video bg-gray-900">
                  <img
                    src={session.imageUrl}
                    alt={session.scenario.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-serpico-red text-white mb-1">
                      {session.difficulty.toUpperCase()}
                    </span>
                    <h2 className="text-xl font-bold text-white">{session.scenario.title}</h2>
                    <p className="text-sm text-gray-200">{session.scenario.setting}</p>
                  </div>
                </div>
              )}

              <div className={`p-4 ${cardBg}`}>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    📋 {session.scenario.codexReference}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    📚 {session.scenario.caseStudyRef}
                  </span>
                </div>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Suspect:</strong> {session.scenario.suspectProfile}
                </p>
              </div>
            </div>

            {/* History */}
            {session.history.length > 0 && (
              <div className="space-y-2">
                {session.history.map((h) => (
                  <div key={h.turn} className={`p-3 rounded-xl text-sm ${isDark ? 'bg-gray-800/60' : 'bg-white border border-gray-100'}`}>
                    <p className={`text-xs font-medium ${muted} mb-1`}>Round {h.turn} — Your call</p>
                    <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>{h.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Current turn */}
            {session.currentTurn && (
              <div className={`p-4 sm:p-5 rounded-2xl border-l-4 border-serpico-blue ${cardBg} shadow-sm`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{session.currentTurn.reactionEmoji}</span>
                  <span className="font-bold text-serpico-blue">{session.currentTurn.turnLabel}</span>
                </div>
                <p className={`text-sm sm:text-base mb-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {session.currentTurn.narrative}
                </p>
                {session.currentTurn.twist && (
                  <div className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-red-900/20 border border-red-800/40' : 'bg-red-50 border border-red-100'}`}>
                    <p className="text-xs font-semibold text-serpico-red mb-1">⚡ TWIST</p>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{session.currentTurn.twist}</p>
                  </div>
                )}
                <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {session.currentTurn.question}
                </p>
                {session.currentTurn.hint && (
                  <p className={`text-xs italic ${muted} mb-3`}>💡 Hint: {session.currentTurn.hint}</p>
                )}

                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Radio in your tactical decision..."
                  rows={3}
                  disabled={loading}
                  className={`w-full p-3 rounded-xl border text-sm resize-none ${
                    isDark
                      ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <button
                  onClick={submitAnswer}
                  disabled={loading || !answer.trim()}
                  className="mt-2 w-full py-3 rounded-xl bg-serpico-blue text-white font-semibold disabled:opacity-50 hover:bg-opacity-90 transition-colors"
                >
                  {loading
                    ? 'AI is reacting...'
                    : session.turn >= session.maxTurns
                    ? '🏁 Submit Final Call & Get Score'
                    : '➡️ Submit & Next Twist'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Evaluation */}
        {phase === 'evaluation' && session?.evaluation && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className={`p-6 rounded-2xl text-center ${cardBg} shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="text-6xl mb-2 animate-bounce">{session.evaluation.badge}</div>
              <h2 className="text-2xl font-bold dark:text-white">{session.evaluation.rank}</h2>
              <div className="my-4">
                <span className="text-5xl font-black text-serpico-red">{session.evaluation.score}</span>
                <span className={`text-xl ${muted}`}> / {session.evaluation.maxScore}</span>
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{session.evaluation.summary}</p>
              <p className="mt-3 text-sm font-medium text-serpico-blue">{session.evaluation.funClosing}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-4 rounded-xl ${cardBg} border ${isDark ? 'border-green-800/40' : 'border-green-200'}`}>
                <h3 className="font-bold text-green-600 dark:text-green-400 mb-2">✅ Strengths</h3>
                <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {session.evaluation.strengths.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
              <div className={`p-4 rounded-xl ${cardBg} border ${isDark ? 'border-amber-800/40' : 'border-amber-200'}`}>
                <h3 className="font-bold text-amber-600 dark:text-amber-400 mb-2">📈 Level Up</h3>
                <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {session.evaluation.improvements.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${cardBg} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className="font-bold dark:text-white mb-2">📋 Codex Alignment</h3>
              <p className={`text-sm ${muted}`}>{session.evaluation.codexAlignment}</p>
              <h3 className="font-bold dark:text-white mt-3 mb-2">📚 Case Study Notes</h3>
              <p className={`text-sm ${muted}`}>{session.evaluation.caseStudyNotes}</p>
            </div>

            {session.history.length > 0 && (
              <div className={`p-4 rounded-xl ${cardBg}`}>
                <h3 className="font-bold dark:text-white mb-2">Your decisions this mission</h3>
                <div className="space-y-2">
                  {session.history.map((h) => (
                    <div key={h.turn} className={`text-sm p-2 rounded-lg ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      <span className={`text-xs ${muted}`}>Round {h.turn}:</span>{' '}
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{h.answer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={resetGame}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-serpico-red to-serpico-blue text-white font-bold"
            >
              🔄 Play Another Scenario
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChaseGame;
