import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Zap, 
  Skull, 
  Settings, 
  Cpu, 
  User,
  Info,
  MousePointer2,
  ShieldAlert
} from 'lucide-react';

// Constants
const ENERGY_CAPACITY = 100;
const COST_PER_MOVE = 18;
const REGEN_RATE = 0.55; 
const TICK_RATE = 100; 
const AI_THINK_RATE = 1200; 

const App = () => {
  // Game State
  const [gameState, setGameState] = useState('MENU'); 
  const [boardSize, setBoardSize] = useState(5); // Default 5x5
  const fogOfWar = false; 
  const [countdown, setCountdown] = useState(3);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const [hud, setHud] = useState({
    playerEnergy: 100,
    aiEnergy: 100,
    playerStones: 0,
    aiStones: 0,
    playerCaptures: 0,
    aiCaptures: 0,
  });

  const [winner, setWinner] = useState(null);

  // Refs for performance and game loop management
  const boardRef = useRef([]); 
  const energyRef = useRef({ player: 100, ai: 100 });
  const captureRef = useRef({ player: 0, ai: 0 });
  const gameLoopRef = useRef(null);
  const aiLoopRef = useRef(null);

  // --- GO ENGINE LOGIC ---
  const getLiberties = useCallback((x, y, board, size) => {
    const color = board[y][x];
    const visited = new Set();
    const group = [];
    const liberties = new Set();
    const stack = [[x, y]];

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);
      group.push([cx, cy]);

      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          if (board[ny][nx] === 0) {
            liberties.add(`${nx},${ny}`);
          } else if (board[ny][nx] === color) {
            stack.push([nx, ny]);
          }
        }
      }
    }
    return { group, libertyCount: liberties.size };
  }, []);

  const processCaptures = useCallback((lastX, lastY, board, size, placingColor) => {
    const opponentColor = placingColor === 1 ? 2 : 1;
    const neighbors = [[lastX + 1, lastY], [lastX - 1, lastY], [lastX, lastY + 1], [lastX, lastY - 1]];
    let totalCaptured = 0;

    neighbors.forEach(([nx, ny]) => {
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && board[ny][nx] === opponentColor) {
        const { group, libertyCount } = getLiberties(nx, ny, board, size);
        if (libertyCount === 0) {
          group.forEach(([gx, gy]) => {
            board[gy][gx] = 0;
            totalCaptured++;
          });
        }
      }
    });
    return totalCaptured;
  }, [getLiberties]);

  const isMoveLegal = useCallback((x, y, board, size, color) => {
    if (board[y][x] !== 0) return false;
    const tempBoard = board.map(row => [...row]);
    tempBoard[y][x] = color;
    const captured = processCaptures(x, y, tempBoard, size, color);
    if (captured > 0) return true;
    const { libertyCount } = getLiberties(x, y, tempBoard, size);
    return libertyCount > 0;
  }, [processCaptures, getLiberties]);

  const endGame = useCallback((reason) => {
    clearInterval(gameLoopRef.current);
    clearInterval(aiLoopRef.current);
    setWinner(reason);
    setGameState('GAMEOVER');
  }, []);

  // --- GAMEPLAY ACTIONS ---
  const updateHud = useCallback(() => {
    let pStones = 0, aStones = 0;
    boardRef.current.forEach(row => row.forEach(cell => {
      if (cell === 1) pStones++;
      if (cell === 2) aStones++;
    }));

    const pEnergy = energyRef.current.player;

    setHud({
      playerEnergy: Math.floor(pEnergy),
      aiEnergy: Math.floor(energyRef.current.ai),
      playerStones: pStones,
      aiStones: aStones,
      playerCaptures: captureRef.current.player,
      aiCaptures: captureRef.current.ai,
    });

    const totalCells = boardSize * boardSize;
    const occupied = pStones + aStones;

    // Victory conditions
    if (pStones >= 5 && pStones >= aStones * 3) endGame('PLAYER_DOMINANCE');
    else if (aStones >= 5 && aStones >= pStones * 3) endGame('AI_DOMINANCE');
    else if (occupied / totalCells >= 0.95) {
      if (pStones > aStones) endGame('PLAYER_POINTS');
      else if (aStones > pStones) endGame('AI_POINTS');
      else endGame('DRAW');
    }
  }, [boardSize, endGame]);

  const placeStone = useCallback((x, y, color) => {
    if (gameState !== 'PLAYING') return false;
    const energyKey = color === 1 ? 'player' : 'ai';
    if (energyRef.current[energyKey] < COST_PER_MOVE) return false;

    if (isMoveLegal(x, y, boardRef.current, boardSize, color)) {
      boardRef.current[y][x] = color;
      energyRef.current[energyKey] -= COST_PER_MOVE;
      const captured = processCaptures(x, y, boardRef.current, boardSize, color);
      if (color === 1) captureRef.current.player += captured;
      else captureRef.current.ai += captured;
      updateHud();
      return true;
    }
    return false;
  }, [gameState, boardSize, isMoveLegal, processCaptures, updateHud]);

  const buyPowerUp = (type) => {
    if (type === 'SURGE' && hud.playerCaptures >= 10) {
      captureRef.current.player -= 10;
      energyRef.current.player = Math.min(ENERGY_CAPACITY, energyRef.current.player + 30);
      updateHud();
    } else if (type === 'SABOTAGE' && hud.playerCaptures >= 15) {
      captureRef.current.player -= 15;
      energyRef.current.ai = Math.max(0, energyRef.current.ai - 20);
      updateHud();
    }
  };

  const initGame = () => {
    boardRef.current = Array(boardSize).fill(0).map(() => Array(boardSize).fill(0));
    energyRef.current = { player: 100, ai: 100 };
    captureRef.current = { player: 0, ai: 0 };
    setWinner(null);
    setCountdown(3);
    setGameState('COUNTDOWN');
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('PLAYING');
      }
    }
  }, [gameState, countdown]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = setInterval(() => {
        energyRef.current.player = Math.min(ENERGY_CAPACITY, energyRef.current.player + REGEN_RATE);
        energyRef.current.ai = Math.min(ENERGY_CAPACITY, energyRef.current.ai + REGEN_RATE);
        updateHud();
      }, TICK_RATE);

      aiLoopRef.current = setInterval(() => {
        if (energyRef.current.ai >= COST_PER_MOVE) {
          const possibleMoves = [];
          for(let y=0; y<boardSize; y++) {
            for(let x=0; x<boardSize; x++) {
              if (boardRef.current[y][x] === 0 && isMoveLegal(x, y, boardRef.current, boardSize, 2)) {
                possibleMoves.push({x, y});
              }
            }
          }
          if (possibleMoves.length > 0) {
            const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            placeStone(move.x, move.y, 2);
          }
        }
      }, AI_THINK_RATE);

      return () => {
        clearInterval(gameLoopRef.current);
        clearInterval(aiLoopRef.current);
      };
    }
  }, [gameState, boardSize, updateHud, isMoveLegal, placeStone]);

  const isVisible = (x, y) => {
    if (!fogOfWar) return true;
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (boardRef.current[row][col] === 1) {
          const dist = Math.sqrt(Math.pow(x - col, 2) + Math.pow(y - row, 2));
          if (dist <= 2.2) return true;
        }
      }
    }
    return false;
  };

  if (gameState === 'MENU') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-mono relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#0ea5e9,transparent_50%)] animate-pulse" />
        </div>

        <div className="z-10 text-center max-w-2xl w-full">
          <h1 className="text-6xl font-black italic mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-rose-500 to-sky-600">
            FRENZY GO
          </h1>
          <p className="text-zinc-500 mb-12 uppercase tracking-widest text-sm">Real-Time Hybrid Protocol // v2.5</p>

          <div className="bg-[#1a1a1a] border border-zinc-800 p-8 rounded-2xl shadow-2xl space-y-8 text-left">
            {!showInstructions ? (
              <>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-4 uppercase tracking-wider">
                    <Settings size={14} /> Matrix Dimension
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {[5, 9, 13, 19].map(size => (
                      <button 
                        key={size}
                        onClick={() => setBoardSize(size)}
                        className={`py-3 rounded-lg border transition-all font-bold ${boardSize === size ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={initGame}
                    className="group flex-1 py-5 bg-sky-500 hover:bg-white text-black font-black text-2xl rounded-xl transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 uppercase overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    <Zap fill="black" className="group-hover:animate-bounce" /> 
                    ENGAGE COMBAT
                  </button>
                  <button 
                    onClick={() => setShowInstructions(true)}
                    className="w-20 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center transition-colors border border-zinc-700"
                    title="How to Play"
                  >
                    <Info size={28} />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-black italic text-sky-400 uppercase tracking-tighter flex items-center gap-2">
                    <Info size={20} /> Combat Manual
                  </h3>
                  <button onClick={() => setShowInstructions(false)} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest underline decoration-sky-500 underline-offset-4">Return</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px] leading-relaxed">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1 text-sky-500"><MousePointer2 size={18} /></div>
                      <div>
                        <strong className="block text-zinc-300 uppercase mb-1">Real-Time Action</strong>
                        This is not turn-based. Place stones as fast as your energy allows. Surrounding enemy groups captures them instantly.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 text-sky-500"><Zap size={18} /></div>
                      <div>
                        <strong className="block text-zinc-300 uppercase mb-1">Energy Management</strong>
                        Each move costs <span className="text-sky-400 font-bold">18 units</span>. Energy regenerates automatically. Don't spam or you'll be left defenseless.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1 text-rose-500"><Skull size={18} /></div>
                      <div>
                        <strong className="block text-zinc-300 uppercase mb-1">Capture & Upgrade</strong>
                        Capturing stones earns <span className="text-rose-400 font-bold">Soul Fragments</span>. Use them in the side panel to buy Surge or Sabotage.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1 text-sky-500"><ShieldAlert size={18} /></div>
                      <div>
                        <strong className="block text-zinc-300 uppercase mb-1">Victory Path</strong>
                        Win by dominating the board (3x opponent's stones) or by having more territory when the board is 95% full.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/20 p-4 rounded-lg text-xs text-sky-200/70 italic text-center">
                  "Speed is a weapon. Territory is the objective."
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'COUNTDOWN') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[12rem] font-black italic text-sky-500 animate-ping absolute">
          {countdown === 0 ? "GO!" : countdown}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0c0b] text-white flex flex-col font-mono select-none overflow-hidden">
      <div className="grid grid-cols-3 p-4 bg-black/80 border-b border-zinc-800 backdrop-blur-md">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sky-400 font-black text-xs uppercase">
                <User size={14} /> Operator
            </div>
            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div 
                    className="h-full bg-sky-500 transition-all duration-100 ease-linear shadow-[0_0_10px_#0ea5e9]" 
                    style={{ width: `${hud.playerEnergy}%` }}
                />
            </div>
        </div>

        <div className="flex flex-col items-center justify-center">
            <div className="text-2xl font-black flex items-center gap-4">
                <span className="text-sky-500">{hud.playerStones}</span>
                <span className="text-zinc-800">|</span>
                <span className="text-rose-500">{hud.aiStones}</span>
            </div>
        </div>

        <div className="flex flex-col gap-2 text-right">
            <div className="flex items-center justify-end gap-2 text-rose-500 font-black text-xs uppercase">
                Core <Cpu size={14} />
            </div>
            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 flex justify-end">
                <div 
                    className="h-full bg-rose-500 transition-all duration-100 ease-linear shadow-[0_0_10px_#f43f5e]" 
                    style={{ width: `${hud.aiEnergy}%` }}
                />
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row relative">
        <div className="w-64 bg-black/40 border-r border-zinc-800 p-6 hidden lg:block space-y-6">
            <div className="space-y-4">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Inventory</div>
                <div className="flex items-center gap-3 text-2xl font-black text-rose-500">
                    <Skull size={24} /> {hud.playerCaptures}
                </div>
            </div>

            <button 
                onClick={() => buyPowerUp('SURGE')}
                disabled={hud.playerCaptures < 10}
                className={`w-full p-3 rounded-lg border text-left flex items-center justify-between ${hud.playerCaptures >= 10 ? 'border-sky-500/50 bg-sky-500/10' : 'border-zinc-800 opacity-30'}`}
            >
                <div className="text-xs font-bold uppercase">Surge (+30 E)</div>
                <Zap size={14} className="text-sky-400" />
            </button>
            <div className="text-[9px] text-zinc-600 uppercase tracking-tighter">Cost: 10 Fragments</div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 lg:p-12">
          <div 
            className="relative bg-[#1e1a16] shadow-2xl border border-zinc-700 aspect-square"
            style={{ 
              width: 'min(75vh, 100%)',
              display: 'grid',
              gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
              gridTemplateRows: `repeat(${boardSize}, 1fr)`
            }}
          >
            <div className="absolute inset-0 pointer-events-none opacity-10">
                {Array.from({ length: boardSize }).map((_, i) => (
                    <React.Fragment key={i}>
                        <div className="absolute bg-zinc-400" style={{ left: `${(i + 0.5) * (100 / boardSize)}%`, top: '5%', bottom: '5%', width: '1px' }} />
                        <div className="absolute bg-zinc-400" style={{ top: `${(i + 0.5) * (100 / boardSize)}%`, left: '5%', right: '5%', height: '1px' }} />
                    </React.Fragment>
                ))}
            </div>

            {boardRef.current.map((row, y) => 
              row.map((cell, x) => {
                const visible = isVisible(x, y);
                return (
                  <div key={`${x}-${y}`} onClick={() => placeStone(x, y, 1)} className="relative cursor-pointer">
                    {!visible ? (
                        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-10" />
                    ) : (
                        <>
                            {cell === 1 && <div className="absolute inset-1.5 rounded-full bg-sky-500 shadow-[0_0_10px_#0ea5e9] z-20" />}
                            {cell === 2 && <div className="absolute inset-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] z-20" />}
                        </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {gameState === 'GAMEOVER' && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
            <div className="text-center space-y-8 max-w-lg w-full">
                <div className="space-y-2">
                    <h2 className={`text-7xl font-black italic tracking-tighter ${winner.startsWith('PLAYER') ? 'text-sky-500' : winner === 'DRAW' ? 'text-zinc-400' : 'text-rose-500'}`}>
                        {winner.startsWith('PLAYER') ? 'VICTORY' : winner === 'DRAW' ? 'STALEMATE' : 'DEFEAT'}
                    </h2>
                    <p className="text-zinc-500 uppercase tracking-[0.3em] font-bold text-sm">
                        {winner.startsWith('PLAYER') ? 'Operator wins' : winner === 'DRAW' ? 'Zero-sum outcome' : 'Core AI wins'}
                    </p>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl inline-block min-w-[300px]">
                    <div className="text-xs text-zinc-500 uppercase mb-4">Final Analysis</div>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <div className="text-sky-500 text-3xl font-black">{hud.playerStones}</div>
                            <div className="text-[10px] text-zinc-500 uppercase">Operator Units</div>
                        </div>
                        <div>
                            <div className="text-rose-500 text-3xl font-black">{hud.aiStones}</div>
                            <div className="text-[10px] text-zinc-500 uppercase">Core Units</div>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-800/50 text-zinc-400 text-xs italic">
                        {winner.includes('DOMINANCE') ? 'Termination by board control dominance' : 
                         winner.includes('POINTS') ? 'Resolution by territorial scoring' : 
                         'Board saturation reached'}
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={() => setGameState('MENU')}
                        className="group relative px-12 py-5 bg-white text-black font-black rounded-lg hover:bg-sky-400 hover:text-white transition-all uppercase flex items-center justify-center mx-auto"
                    >
                        Initialize New Protocol
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;