/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE, LEVELS, LevelConfig } from './types';
import { SaveSystem } from './components/System/SaveSystem';

interface GameState {
  status: GameStatus;
  lastStatus: GameStatus; 
  score: number;
  highScore: number;
  totalLifetimeGems: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  
  // Level System
  levelIndex: number; 
  currentLevelConfig: LevelConfig;
  laneCount: number;
  
  gemsCollected: number;
  distance: number;
  
  // Combo System
  combo: number;
  multiplier: number;

  // Boss System
  bossMaxHealth: number;
  bossCurrentHealth: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  hasTimeDilation: boolean;
  hasMagnet: boolean;
  
  // Ability Active States
  isImmortalityActive: boolean;
  isTimeDilationActive: boolean;
  isMagnetActive: boolean;
  isSliding: boolean;
  
  // Ability Cooldowns (Timestamps)
  cooldowns: {
      ghost: number;
      time: number;
      magnet: number;
  };

  // Modifiers
  timeScale: number; 

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  damageBoss: (amount: number) => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL' | 'TIME_SLOW' | 'MAGNET', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  
  // Ability Triggers
  activateImmortality: () => void;
  activateTimeDilation: () => void;
  activateMagnet: () => void;
  
  setSliding: (sliding: boolean) => void;
  
  // Combo Logic
  increaseCombo: () => void;
  resetCombo: () => void;
}

const SNEAKY_TARGET = ['S', 'N', 'E', 'A', 'K', 'Y'];
const savedData = SaveSystem.load();

export const COOLDOWN_DURATIONS = {
    ghost: 45000,
    time: 30000,
    magnet: 30000
};

export const ABILITY_DURATIONS = {
    ghost: 5000,
    time: 5000,
    magnet: 8000
};

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  lastStatus: GameStatus.MENU, 
  score: 0,
  highScore: savedData.highScore,
  totalLifetimeGems: savedData.totalLifetimeGems,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  
  levelIndex: 0,
  currentLevelConfig: LEVELS[0],
  laneCount: LEVELS[0].lanes,
  
  gemsCollected: 0,
  distance: 0,
  
  combo: 0,
  multiplier: 1,

  bossMaxHealth: 100,
  bossCurrentHealth: 100,
  
  hasDoubleJump: false,
  hasImmortality: false,
  hasTimeDilation: false,
  hasMagnet: false,
  
  isImmortalityActive: false,
  isTimeDilationActive: false,
  isMagnetActive: false,
  isSliding: false,

  timeScale: 1.0,
  
  cooldowns: {
      ghost: 0,
      time: 0,
      magnet: 0
  },

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: LEVELS[0].baseSpeed,
    collectedLetters: [],
    levelIndex: 0,
    currentLevelConfig: LEVELS[0],
    laneCount: LEVELS[0].lanes,
    gemsCollected: 0,
    distance: 0,
    combo: 0,
    multiplier: 1,
    
    hasDoubleJump: false,
    hasImmortality: false,
    hasTimeDilation: false,
    hasMagnet: false,
    
    isImmortalityActive: false,
    isTimeDilationActive: false,
    isMagnetActive: false,
    isSliding: false,
    timeScale: 1.0,
    
    cooldowns: { ghost: 0, time: 0, magnet: 0 },
    
    bossMaxHealth: 100,
    bossCurrentHealth: 100
  }),

  restartGame: () => get().startGame(),

  takeDamage: () => {
    const { lives, isImmortalityActive, score, highScore, gemsCollected, totalLifetimeGems } = get();
    if (isImmortalityActive) return; 

    // Reset Combo on Hit
    set({ combo: 0, multiplier: 1 });

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      const newHighScore = Math.max(score, highScore);
      const newTotalGems = totalLifetimeGems + gemsCollected;
      
      SaveSystem.save({
        highScore: newHighScore,
        totalLifetimeGems: newTotalGems
      });

      set({ 
        lives: 0, 
        status: GameStatus.GAME_OVER, 
        speed: 0,
        highScore: newHighScore,
        totalLifetimeGems: newTotalGems
      });
    }
  },

  increaseCombo: () => set(state => {
      const newCombo = state.combo + 1;
      const newMultiplier = 1 + Math.floor(newCombo / 10) * 0.5; // +0.5x every 10 combo
      return { combo: newCombo, multiplier: Math.min(newMultiplier, 10) };
  }),

  resetCombo: () => set({ combo: 0, multiplier: 1 }),

  damageBoss: (amount) => {
      const { bossCurrentHealth, bossMaxHealth, score, highScore, totalLifetimeGems, gemsCollected } = get();
      const newHealth = Math.max(0, bossCurrentHealth - amount);
      
      set({ bossCurrentHealth: newHealth });

      if (newHealth <= 0) {
           const finalScore = score + 10000;
           const newHighScore = Math.max(finalScore, highScore);
           const newTotalGems = totalLifetimeGems + gemsCollected;

           SaveSystem.save({
              highScore: newHighScore,
              totalLifetimeGems: newTotalGems
           });

           set({
               status: GameStatus.VICTORY,
               score: finalScore,
               highScore: newHighScore,
               totalLifetimeGems: newTotalGems
           });
      }
  },

  addScore: (amount) => set((state) => ({ score: state.score + (amount * state.multiplier) })),
  
  collectGem: (value) => {
      get().increaseCombo();
      const { multiplier } = get();
      set((state) => ({ 
        score: state.score + (value * multiplier), 
        gemsCollected: state.gemsCollected + 1 
      }));
  },

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, levelIndex, speed, currentLevelConfig } = get();
    get().increaseCombo();
    
    if (currentLevelConfig.hasBoss) return; 

    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      const speedIncrease = currentLevelConfig.baseSpeed * 0.05;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      if (newLetters.length === SNEAKY_TARGET.length) {
        if (levelIndex < LEVELS.length - 1) {
            get().advanceLevel();
        } else {
            get().advanceLevel(); 
        }
      }
    }
  },

  advanceLevel: () => {
      const { levelIndex } = get();
      const nextIndex = levelIndex + 1;

      if (nextIndex < LEVELS.length) {
          const nextConfig = LEVELS[nextIndex];
          set({
              levelIndex: nextIndex,
              currentLevelConfig: nextConfig,
              laneCount: nextConfig.lanes,
              status: GameStatus.PLAYING,
              speed: nextConfig.baseSpeed,
              collectedLetters: [],
              bossMaxHealth: nextConfig.bossHealth || 100,
              bossCurrentHealth: nextConfig.bossHealth || 100
          });
      }
  },

  openShop: () => {
      set((state) => ({ 
          status: GameStatus.SHOP,
          lastStatus: state.status 
      }));
  },
  
  closeShop: () => {
      set((state) => ({ status: state.lastStatus }));
  },

  buyItem: (type, cost) => {
      const { score, maxLives, lives } = get();
      
      if (score >= cost) {
          set({ score: score - cost });
          
          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
                  set({ maxLives: maxLives + 1, lives: lives + 1 });
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
              case 'TIME_SLOW':
                  set({ hasTimeDilation: true });
                  break;
              case 'MAGNET':
                  set({ hasMagnet: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive, cooldowns } = get();
      const now = Date.now();
      if (hasImmortality && !isImmortalityActive && now - cooldowns.ghost > COOLDOWN_DURATIONS.ghost) {
          set(state => ({ 
              isImmortalityActive: true, 
              cooldowns: { ...state.cooldowns, ghost: now } 
          }));
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, ABILITY_DURATIONS.ghost);
      }
  },

  activateTimeDilation: () => {
      const { hasTimeDilation, isTimeDilationActive, cooldowns } = get();
      const now = Date.now();
      if (hasTimeDilation && !isTimeDilationActive && now - cooldowns.time > COOLDOWN_DURATIONS.time) {
          set(state => ({ 
              isTimeDilationActive: true, 
              timeScale: 0.4, 
              cooldowns: { ...state.cooldowns, time: now } 
          }));
          setTimeout(() => {
              set({ isTimeDilationActive: false, timeScale: 1.0 });
          }, ABILITY_DURATIONS.time);
      }
  },

  activateMagnet: () => {
      const { hasMagnet, isMagnetActive, cooldowns } = get();
      const now = Date.now();
      if (hasMagnet && !isMagnetActive && now - cooldowns.magnet > COOLDOWN_DURATIONS.magnet) {
          set(state => ({ 
              isMagnetActive: true, 
              cooldowns: { ...state.cooldowns, magnet: now } 
          }));
          setTimeout(() => {
              set({ isMagnetActive: false });
          }, ABILITY_DURATIONS.magnet);
      }
  },

  setStatus: (status) => set({ status }),
  setSliding: (sliding) => set({ isSliding: sliding })
}));