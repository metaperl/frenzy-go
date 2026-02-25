import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Zap, 
  Skull, 
  Trophy, 
  Settings, 
  Play, 
  RotateCcw, 
  Info, 
  Cpu, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle,
  TrendingUp, 
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
  const [boardSize, setBoardSize] = useState(9);
  const [fogOfWar, setFogOfWar] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  const [hud, setHud] = useState({
    playerEnergy: 100,
    aiEnergy: 100,
    playerStones: 0,
    aiStones: 0,
    playerCaptures: 0,
    aiCaptures: 0,
  });

  const [winner, setWinner] = useState(null);
  const [showRules, setShowRules] = useState(false);

  // High-performance Refs
  const boardRef = useRef([]); 
  const energyRef = useRef({ player: 100, ai: 100 });
  const captureRef = useRef({ player: 0, ai: 0 });
  const gameLoopRef = useRef(null);
  const aiLoopRef = useRef(null);

  // --- GO ENGINE LOGIC ---
  const getLiberties = (x, y, board, size) => {
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
  };

  const processCaptures = (lastX, lastY, board, size, placingColor) => {
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
  };

  const isMoveLegal = (x, y, board, size, color) => {
    if (board[y][x] !== 0) return false;
    const tempBoard = board.map(row => [...row]);
    tempBoard[y][x] = color;
    const captured = processCaptures(x, y, tempBoard, size, color);
    if (captured > 0) return true;
    const { libertyCount } = getLiberties(x, y, tempBoard, size);
    return libertyCount > 0;
  };

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

    if (pStones >= 10 && pStones >= aStones * 2) endGame('PLAYER_DOMINANCE');
    else if (aStones >= 10 && aStones >= pStones * 2) endGame('AI_DOMINANCE');
    else if (occupied / totalCells >= 0.95) {
      if (pStones > aStones) endGame('PLAYER_POINTS');
      else endGame('AI_POINTS');
    }
  }, [boardSize]);

  const placeStone = (x, y, color) => {
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
  };

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
    setGameState('COUNTDOWN');
  };

  const endGame = (reason) => {
    clearInterval(gameLoopRef.current);
    clearInterval(aiLoopRef.current);
    setWinner(reason);
    setGameState('GAMEOVER');
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
  }, [gameState, boardSize, updateHud]);

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

        <div className="z-10 text-center max-w-lg w-full">
          <h1 className="text-6xl font-black italic mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-rose-500 to-sky-600">
            FRENZY GO
          </h1>
          <p className="text-zinc-500 mb-12 uppercase tracking-widest text-sm">Real-Time Hybrid Protocol // v2.5</p>

          <div className="bg-[#1a1a1a] border border-zinc-800 p-8 rounded-2xl shadow-2xl space-y-8">
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-4 uppercase">
                <Settings size={14} /> Matrix Dimension
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[5, 9, 13, 19].map(size => (
                  <button 
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className={`py-3 rounded-lg border transition-all ${boardSize === size ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={initGame}
              className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-black font-black text-xl rounded-xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center gap-2 uppercase"
            >
              <Play fill="black" /> START SEQUENCE
            </button>
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
                <div className="text-xs font-bold">ENERGY SURGE</div>
                <Zap size={14} className="text-sky-400" />
            </button>
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
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6">
            <div className="text-center space-y-8">
                <h2 className={`text-6xl font-black italic ${winner.startsWith('PLAYER') ? 'text-sky-500' : 'text-rose-500'}`}>
                    {winner.startsWith('PLAYER') ? 'SYSTEM CLEAR' : 'CORE COLLAPSE'}
                </h2>
                <button 
                    onClick={() => setGameState('MENU')}
                    className="px-8 py-4 bg-white text-black font-black rounded-lg hover:bg-zinc-200 uppercase"
                >
                    Return to Menu
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;