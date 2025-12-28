/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ObjectType {
  OBSTACLE = 'OBSTACLE',
  GEM = 'GEM',
  LETTER = 'LETTER',
  SHOP_PORTAL = 'SHOP_PORTAL',
  ALIEN = 'ALIEN',
  MISSILE = 'MISSILE',
  BOSS = 'BOSS',
  VIRUS = 'VIRUS' // Used to damage boss
}

export enum ObstacleVariant {
    BEAM = 0, // Requires Sliding
    WALL = 1, // Requires Jumping
    BARREL = 2 // Dodge or Jump
}

export interface GameObject {
  id: string;
  type: ObjectType;
  position: [number, number, number]; // x, y, z
  active: boolean;
  value?: string; // For letters
  color?: string;
  targetIndex?: number; // Index in the SNEAKY target word
  points?: number; // Score value for gems
  hasFired?: boolean; // For Aliens
  hasNearMissed?: boolean; // Track if player narrowly avoided this
  variant?: ObstacleVariant; // For diverse obstacles
  // Boss specific
  maxHealth?: number;
  currentHealth?: number;
}

export const LANE_WIDTH = 2.2;
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.6; // seconds
export const SLIDE_DURATION = 0.8; // seconds
export const RUN_SPEED_BASE = 22.5;
export const SPAWN_DISTANCE = 120;
export const REMOVE_DISTANCE = 20; // Behind player

// SNEAKY Colors: Purple, Blue, Green, Yellow, Orange, Red
export const SNEAKY_COLORS = [
    '#d946ef', // S - Fuchsia
    '#00d9ff', // N - Cyan
    '#00ff41', // E - Matrix Green
    '#fffb00', // A - Yellow
    '#ff8c00', // K - Orange
    '#ff0040', // Y - Red
];

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}

// --- LEVEL SYSTEM ---

export interface LevelTheme {
    primary: string;    // Road lines, UI accents
    secondary: string;  // Background fog, buildings
    grid: string;       // Floor grid
    sky: string;        // Horizon
}

export interface LevelConfig {
    id: number;
    name: string;
    subtext: string;
    baseSpeed: number;
    lanes: number;
    enemies: {
        aliens: boolean;
        missiles: boolean;
        formations: boolean;
    };
    hasBoss: boolean;
    bossHealth?: number;
    theme: LevelTheme;
}

export const LEVELS: LevelConfig[] = [
    {
        id: 1,
        name: 'ACCESS NODE',
        subtext: 'INFILTRATION STARTED',
        baseSpeed: 24, // Slightly faster start for impact
        lanes: 3,
        enemies: { aliens: false, missiles: false, formations: false },
        hasBoss: false,
        theme: {
            primary: '#00d9ff', // Cyan
            secondary: '#001a33', // Deep Blue
            grid: '#004d4d',
            sky: '#002244'
        }
    },
    {
        id: 2,
        name: 'FIREWALL ZONE',
        subtext: 'SECURITY ALERT',
        baseSpeed: 30,
        lanes: 5,
        enemies: { aliens: true, missiles: true, formations: false },
        hasBoss: false,
        theme: {
            primary: '#ff3300', // Orange/Red
            secondary: '#2a0a00', // Dark Rust
            grid: '#661a00',
            sky: '#330000'
        }
    },
    {
        id: 3,
        name: 'CORE PROCESS',
        subtext: 'CRITICAL INSTABILITY',
        baseSpeed: 38,
        lanes: 7,
        enemies: { aliens: true, missiles: true, formations: true },
        hasBoss: false,
        theme: {
            primary: '#d946ef', // Magenta/Purple
            secondary: '#1a0033', // Deep Purple
            grid: '#4d004d',
            sky: '#220033'
        }
    },
    {
        id: 4,
        name: 'SYSTEM ADMIN',
        subtext: 'FINAL GUARDIAN',
        baseSpeed: 45,
        lanes: 7,
        enemies: { aliens: false, missiles: true, formations: true },
        hasBoss: true,
        bossHealth: 100,
        theme: {
            primary: '#ffd700', // Gold
            secondary: '#000000', // Void Black
            grid: '#332b00',
            sky: '#111111'
        }
    }
];