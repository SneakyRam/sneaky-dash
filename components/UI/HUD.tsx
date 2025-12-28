/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect } from 'react';
import { Shield, Zap, Home, Play, Lock, Radio, Terminal, Crosshair, Clock, Magnet, ShoppingBag, Activity } from 'lucide-react';
import { useStore, COOLDOWN_DURATIONS, ABILITY_DURATIONS } from '../../store';
import { GameStatus, SNEAKY_COLORS, ShopItem, RUN_SPEED_BASE } from '../../types';
import { audio } from '../System/Audio';
import { eventBus } from '../System/EventBus';

// Helper Icon
const PlusIcon = () => <div className="text-xl font-bold">+</div>;

// Available Shop Items
const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'DOUBLE_JUMP',
        name: 'AIR STEP',
        description: 'Mid-air jump ability.',
        cost: 250,
        icon: Zap,
        oneTime: true
    },
    {
        id: 'TIME_SLOW',
        name: 'CHRONO (Q)',
        description: 'Slow down time.',
        cost: 400,
        icon: Clock,
        oneTime: true
    },
    {
        id: 'MAGNET',
        name: 'MAGNET (E)',
        description: 'Attract items.',
        cost: 350,
        icon: Magnet,
        oneTime: true
    },
    {
        id: 'IMMORTAL',
        name: 'SHADOW CLOAK (R)',
        description: 'Invulnerability.',
        cost: 500,
        icon: Lock,
        oneTime: true
    },
    {
        id: 'MAX_LIFE',
        name: 'ARMOR VEST',
        description: 'Add extra integrity.',
        cost: 400,
        icon: Shield
    },
    {
        id: 'HEAL',
        name: 'MED KIT',
        description: 'Restore 1 integrity.',
        cost: 100,
        icon: PlusIcon
    }
];

const ShopScreen: React.FC = () => {
    const { score, buyItem, closeShop, hasDoubleJump, hasImmortality, hasTimeDilation, hasMagnet } = useStore();
    const [items, setItems] = useState<ShopItem[]>([]);

    useEffect(() => {
        let pool = SHOP_ITEMS.filter(item => {
            if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
            if (item.id === 'IMMORTAL' && hasImmortality) return false;
            if (item.id === 'TIME_SLOW' && hasTimeDilation) return false;
            if (item.id === 'MAGNET' && hasMagnet) return false;
            return true;
        });
        pool = pool.sort(() => 0.5 - Math.random());
        setItems(pool.slice(0, 3));
    }, []);

    return (
        <div 
            className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg pointer-events-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}
        >
             <div className="w-full max-w-5xl border border-white/20 p-8 bg-black relative max-h-full overflow-y-auto">
                 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>

                 <h2 className="text-4xl font-black text-white mb-2 font-cyber tracking-widest text-center">BLACK MARKET</h2>
                 <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-8">
                     <span className="text-gray-500 font-mono text-sm tracking-widest">SECURE CONNECTION</span>
                     <div className="flex items-center text-white font-mono">
                         <span className="mr-4 text-gray-400">COINS::</span>
                         <span className="text-2xl font-bold">{score.toLocaleString()}</span>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     {items.map(item => {
                         const Icon = item.icon;
                         const canAfford = score >= item.cost;
                         return (
                             <div key={item.id} className="border border-gray-800 bg-gray-900/50 p-6 flex flex-col items-center text-center hover:border-white/50 transition-colors group">
                                 <div className="mb-4 text-gray-400 group-hover:text-white transition-colors">
                                     <Icon className="w-10 h-10" />
                                 </div>
                                 <h3 className="text-lg font-bold text-white mb-2 font-cyber tracking-wider">{item.name}</h3>
                                 <p className="text-gray-400 text-xs font-mono mb-6 h-8">{item.description}</p>
                                 <button 
                                    onClick={() => buyItem(item.id as any, item.cost)}
                                    disabled={!canAfford}
                                    className={`w-full py-2 font-bold text-sm tracking-widest border ${canAfford ? 'border-white text-white hover:bg-white hover:text-black' : 'border-gray-800 text-gray-700 cursor-not-allowed'}`}
                                 >
                                     {item.cost}
                                 </button>
                             </div>
                         );
                     })}
                 </div>

                 <div className="flex justify-center pb-4 md:pb-0">
                    <button 
                        onClick={closeShop}
                        className="px-12 py-3 bg-white/10 border border-white/50 text-white hover:bg-white hover:text-black font-bold tracking-widest transition-all font-mono"
                    >
                        LEAVE
                    </button>
                 </div>
             </div>
        </div>
    );
};

const AbilityButton: React.FC<{
    icon: React.FC<any>;
    isActive: boolean;
    cooldownStart: number;
    duration: number; // Total cooldown duration
    activeDuration: number;
    onClick: () => void;
    themeColor: string;
    hotkey: string;
}> = ({ icon: Icon, isActive, cooldownStart, duration, activeDuration, onClick, themeColor, hotkey }) => {
    const [progress, setProgress] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (isActive) {
                // Showing active depletion? or just generic active glow
                setProgress(100);
            } else if (cooldownStart > 0) {
                const elapsed = now - cooldownStart;
                const p = Math.min(100, (elapsed / duration) * 100);
                setProgress(p);
            } else {
                setProgress(100); // Ready
            }
        }, 100);
        return () => clearInterval(interval);
    }, [isActive, cooldownStart, duration]);

    const isReady = !isActive && (Date.now() - cooldownStart > duration || cooldownStart === 0);

    return (
        <button 
            onClick={onClick}
            disabled={!isReady}
            style={{ borderColor: isReady ? themeColor : 'rgba(75, 85, 99, 1)' }}
            className={`relative w-16 h-16 md:w-16 md:h-16 flex items-center justify-center border bg-black/80 transition-all active:scale-95 ${isReady ? 'shadow-[0_0_15px_rgba(0,0,0,0.5)]' : 'opacity-50'}`}
        >
            {/* Background Fill for Cooldown */}
            {!isReady && !isActive && (
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-white/10 transition-all duration-100"
                    style={{ height: `${progress}%` }}
                ></div>
            )}
            
            {/* Active Glow */}
            {isActive && (
                <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: themeColor, opacity: 0.2 }}></div>
            )}
            
            {/* Ready Pulse */}
            {isReady && !isActive && (
                 <div className="absolute inset-0 animate-pulse border-2" style={{ borderColor: themeColor, opacity: 0.5 }}></div>
            )}

            <Icon className={`w-8 h-8 md:w-8 md:h-8 relative z-10 ${isActive ? 'text-white' : isReady ? 'text-white' : 'text-gray-500'}`} style={{ color: isReady ? themeColor : undefined }} />
            
            {/* Hotkey Indicator */}
            <div className="absolute top-1 right-1 bg-black/80 px-1 text-[10px] font-mono text-gray-400 border border-gray-700">
                {hotkey}
            </div>
            
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-1 h-1 bg-gray-500"></div>
            <div className="absolute top-0 right-0 w-1 h-1 bg-gray-500"></div>
            <div className="absolute bottom-0 left-0 w-1 h-1 bg-gray-500"></div>
            <div className="absolute bottom-0 right-0 w-1 h-1 bg-gray-500"></div>
        </button>
    );
};

export const HUD: React.FC = () => {
  const { 
      score, lives, maxLives, collectedLetters, status, currentLevelConfig, 
      restartGame, startGame, gemsCollected, distance, 
      speed, highScore, setStatus, bossCurrentHealth, bossMaxHealth,
      // Ability Props
      hasImmortality, hasTimeDilation, hasMagnet,
      isImmortalityActive, isTimeDilationActive, isMagnetActive,
      activateImmortality, activateTimeDilation, activateMagnet,
      cooldowns,
      openShop,
      combo, multiplier
  } = useStore();
  
  const target = ['S', 'N', 'E', 'A', 'K', 'Y'];
  const [nearMissActive, setNearMissActive] = useState(false);
  const themeColor = currentLevelConfig.theme.primary;

  useEffect(() => {
    const handleNearMiss = () => {
        setNearMissActive(true);
        audio.playNearMiss();
        setTimeout(() => setNearMissActive(false), 800);
    };
    eventBus.on('near-miss', handleNearMiss);
    return () => eventBus.off('near-miss', handleNearMiss);
  }, []);

  const goToMenu = () => {
      setStatus(GameStatus.MENU);
  };

  if (status === GameStatus.SHOP) return <ShopScreen />;

  // --- MENU ---
  if (status === GameStatus.MENU) {
      return (
          <div 
            className="absolute inset-0 z-[100] pointer-events-auto overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}
          >
              <div className="scanline-overlay"></div>
              
              <div className="relative w-full h-full flex flex-col md:flex-row items-center md:items-center p-8 md:p-16 justify-start md:justify-start">
                 
                 {/* Spacer for aesthetics */}
                 <div className="h-4 md:h-0"></div>

                 <div className="flex flex-col z-20 max-w-2xl w-full md:w-auto items-center md:items-start text-center md:text-left">
                     <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-4 h-4 text-cyan-400 opacity-70" />
                        <span className="text-cyan-400/70 font-mono text-xs tracking-[0.3em]">SECURE_TERMINAL_V.9.0</span>
                     </div>

                     <h1 className="text-6xl md:text-9xl font-black font-cyber text-white tracking-tighter leading-none mb-2 animate-glitch"
                         style={{ textShadow: '0 0 40px rgba(0, 255, 255, 0.3)' }}>
                        SNEAKY
                     </h1>
                     <div className="h-1 w-32 bg-white mb-6 shadow-[0_0_20px_white] mx-auto md:mx-0"></div>
                     
                     <p className="text-gray-400 font-mono tracking-widest text-sm mb-12 max-w-md border-l-0 md:border-l border-gray-700 pl-0 md:pl-4 hidden md:block">
                         SYSTEM BREACH IMMINENT. <br/>
                         ELITE OPERATIVE REQUIRED FOR EXTRACTION.
                     </p>
                    
                     {/* MENU BUTTONS */}
                     <div className="flex flex-col gap-4 w-full md:w-auto items-center md:items-start">
                        <button 
                            onClick={() => { audio.init(); startGame(); }}
                            className="group relative w-fit px-10 py-4 md:px-12 md:py-5 bg-transparent border border-white/30 text-white overflow-hidden transition-all duration-300 hover:border-cyan-400 hover:text-cyan-400 hover:bg-black/50"
                        >
                            <div className="absolute inset-0 w-0 bg-white/10 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <span className="font-cyber font-bold text-lg md:text-xl tracking-[0.2em]">INITIALIZE</span>
                                <Play className="w-5 h-5 fill-current" />
                            </div>
                        </button>

                        <button 
                            onClick={() => { audio.init(); openShop(); }}
                            className="group relative w-fit px-10 py-4 md:px-12 md:py-5 bg-transparent border border-white/30 text-white overflow-hidden transition-all duration-300 hover:border-purple-400 hover:text-purple-400 hover:bg-black/50"
                        >
                            <div className="absolute inset-0 w-0 bg-white/10 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <span className="font-cyber font-bold text-lg md:text-xl tracking-[0.2em]">STORE</span>
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                        </button>
                     </div>
                 </div>

                 {/* Decorative elements - Only show on desktop to save space on mobile */}
                 <div className="absolute right-12 top-1/4 flex flex-col gap-4 items-end opacity-50 hidden md:flex animate-float pointer-events-none">
                      <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                          <Crosshair className="w-4 h-4" />
                          TARGET_LOCKED
                      </div>
                      <div className="w-48 h-[1px] bg-gradient-to-l from-cyan-400 to-transparent"></div>
                      <div className="text-[10px] text-gray-500 font-mono text-right">
                          COORDINATES: 45.99, -12.00<br/>
                          SECTOR: DARK_WEB_01
                      </div>
                 </div>
                 
                 <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end border-t border-white/10 pt-4 pointer-events-none">
                      <div className="flex gap-8">
                          {highScore > 0 && (
                            <div className="text-left">
                                <div className="text-[10px] text-gray-500 font-mono tracking-widest mb-1">BEST_RUN</div>
                                <div className="text-2xl font-bold font-cyber text-white">{highScore.toLocaleString()}</div>
                            </div>
                          )}
                          <div className="text-left hidden md:block">
                              <div className="text-[10px] text-gray-500 font-mono tracking-widest mb-1">STATUS</div>
                              <div className="text-2xl font-bold font-cyber text-cyan-400 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                                  ONLINE
                              </div>
                          </div>
                      </div>
                      <div className="text-right text-[10px] text-gray-600 font-mono max-w-xs hidden md:block">
                          WARNING: NEURAL LINK UNSTABLE. <br/>
                          PROCEED WITH EXTREME CAUTION.
                      </div>
                 </div>
              </div>
          </div>
      );
  }

  // --- GAME OVER ---
  if (status === GameStatus.GAME_OVER) {
      return (
          <div 
            className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white pointer-events-auto overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
              {/* Ambient Background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] z-0 opacity-50"></div>
              
              {/* Subtle CRT Lines */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                   style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '100% 4px' }}>
              </div>

              <div className="relative z-10 flex flex-col items-center max-w-4xl w-full px-8">
                  
                  {/* Status Icon - Subtle Pulse */}
                  <div className="mb-4 md:mb-6 opacity-50">
                      <Activity className="w-8 h-8 md:w-12 md:h-12 text-red-500 animate-pulse" />
                  </div>

                  {/* Main Title - Cold & Glitchy - Responsive Text Size */}
                  <h1 className="text-5xl md:text-8xl font-black font-cyber tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 animate-glitch text-center">
                      SIGNAL_LOST
                  </h1>

                  {/* Subtitle - System Message */}
                  <div className="flex items-center gap-3 mb-8 md:mb-16">
                      <div className="h-[1px] w-8 md:w-12 bg-red-900/50"></div>
                      <p className="text-red-500/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.4em] uppercase text-center">
                          CONNECTION TERMINATED UNEXPECTEDLY
                      </p>
                      <div className="h-[1px] w-8 md:w-12 bg-red-900/50"></div>
                  </div>

                  {/* Stats Grid - Clean minimalist look */}
                  <div className="grid grid-cols-3 gap-4 md:gap-16 w-full max-w-2xl mb-12 md:mb-16 border-y border-white/5 py-6 md:py-8">
                      <div className="flex flex-col items-center gap-1 group">
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-mono tracking-widest uppercase group-hover:text-red-500 transition-colors">Sector</span>
                          <span className="text-lg md:text-2xl font-cyber tracking-wide text-center leading-none">{currentLevelConfig.name.split(' ')[0]}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 group">
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-mono tracking-widest uppercase group-hover:text-cyan-400 transition-colors">Data</span>
                          <span className="text-lg md:text-2xl font-cyber tracking-wide text-white">{score.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 group">
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-mono tracking-widest uppercase group-hover:text-white transition-colors">Distance</span>
                          <span className="text-lg md:text-2xl font-cyber tracking-wide">{Math.floor(distance)}m</span>
                      </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-4 w-full max-w-xs z-20">
                      <button 
                          onClick={() => { audio.init(); restartGame(); }} 
                          className="w-full py-4 bg-white text-black font-bold font-mono tracking-[0.2em] hover:bg-gray-200 transition-all duration-300 relative overflow-hidden group"
                      >
                          <span className="relative z-10">REINITIALIZE</span>
                          <div className="absolute inset-0 bg-cyan-400 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0 opacity-20"></div>
                      </button>
                      
                      <button 
                          onClick={goToMenu} 
                          className="w-full py-3 text-gray-600 font-mono text-xs tracking-[0.2em] hover:text-white transition-colors uppercase"
                      >
                          [ System Root ]
                      </button>
                  </div>

              </div>
          </div>
      );
  }

  // --- VICTORY ---
  if (status === GameStatus.VICTORY) {
    return (
        <div className="absolute inset-0 bg-black/95 z-[100] text-white pointer-events-auto flex items-center justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="w-full max-w-lg border border-white/30 bg-black p-8 text-center">
                <Radio className="w-16 h-16 text-white mx-auto mb-4" />
                <h1 className="text-5xl font-black text-white mb-2 font-cyber tracking-widest">SUCCESS</h1>
                <p className="text-gray-400 font-mono text-sm mb-8 tracking-widest">SYSTEM COMPROMISED</p>
                <div className="bg-gray-900 border border-gray-800 p-6 mb-8">
                     <div className="text-xs text-gray-500 font-mono mb-2 tracking-widest">FINAL SCORE</div>
                     <div className="text-5xl font-bold text-white">{score.toLocaleString()}</div>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={() => { audio.init(); restartGame(); }} className="w-full py-4 bg-white text-black font-bold font-mono tracking-widest hover:bg-gray-200 transition-all">NEXT RUN</button>
                    <button onClick={goToMenu} className="w-full py-3 border border-gray-800 text-gray-500 hover:text-white font-bold font-mono tracking-widest">MENU</button>
                </div>
            </div>
        </div>
    );
  }

  // --- MAIN HUD ---
  return (
    <div 
        className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-50"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
    >
        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-4 pointer-events-auto">
                <button 
                    onClick={goToMenu} 
                    className="w-10 h-10 flex items-center justify-center border border-gray-800 bg-black hover:border-white transition-all"
                >
                    <Home className="w-4 h-4 text-white" />
                </button>
                <div className="flex flex-col">
                    <div className="text-[10px] text-gray-500 font-mono tracking-widest">SCORE</div>
                    <div className="text-3xl font-mono font-bold text-white leading-none">
                        {score.toLocaleString()}
                    </div>
                </div>
                
                {/* COMBO METER */}
                {combo > 1 && (
                     <div className="ml-4 flex flex-col animate-pulse">
                        <div className="text-[10px] text-gray-500 font-mono tracking-widest">COMBO</div>
                        <div className="text-2xl font-mono font-bold italic leading-none" style={{ color: themeColor }}>
                             {combo}x <span className="text-sm text-gray-400">({multiplier}x MULT)</span>
                        </div>
                     </div>
                )}
            </div>
            
            <div className="flex flex-col items-end">
                 <div className="text-[10px] text-gray-500 font-mono tracking-widest mb-1">ARMOR</div>
                 <div className="flex space-x-1">
                    {[...Array(maxLives)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-3 h-6 skew-x-[-10deg] border transition-colors duration-300 ${i < lives ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-transparent border-gray-800'}`}
                            style={{ borderColor: i < lives ? themeColor : undefined }}
                        ></div>
                    ))}
                 </div>
            </div>
        </div>
        
        {/* Level Info - Fixed Top Position avoiding safe area */}
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 text-center w-full mt-[env(safe-area-inset-top)]">
             <div className="text-[10px] text-gray-600 font-mono tracking-[0.3em]">
                 LEVEL {currentLevelConfig.id}
             </div>
             <div 
                className="text-md font-bold text-white font-cyber tracking-widest text-shadow-glow"
                style={{ textShadow: `0 0 10px ${themeColor}` }}
             >
                {currentLevelConfig.name}
             </div>
             <div className="text-[8px] font-mono tracking-[0.2em] opacity-80 mt-1" style={{ color: themeColor }}>
                 {currentLevelConfig.subtext}
             </div>
        </div>

        {/* Boss Health Bar */}
        {currentLevelConfig.hasBoss && (
             <div className="absolute top-28 left-1/2 transform -translate-x-1/2 w-64 md:w-96 mt-[env(safe-area-inset-top)]">
                 <div className="flex justify-between text-[10px] text-red-500 font-mono tracking-widest mb-1">
                     <span>SYSTEM ADMIN</span>
                     <span>{(bossCurrentHealth / bossMaxHealth * 100).toFixed(0)}%</span>
                 </div>
                 <div className="w-full h-2 bg-gray-900 border border-red-900">
                     <div 
                        className="h-full bg-red-600 transition-all duration-300"
                        style={{ width: `${(bossCurrentHealth / bossMaxHealth) * 100}%` }}
                     ></div>
                 </div>
             </div>
        )}

        {/* ABILITY BUTTONS */}
        {/* On Mobile: Bottom Right for thumb access. Desktop: Bottom Left stack. Bottom padding handles safe area. */}
        <div className="absolute bottom-6 right-6 md:right-auto md:bottom-20 md:left-6 flex flex-col gap-6 md:gap-4 pointer-events-auto items-end md:items-start mb-[env(safe-area-inset-bottom)]">
            {hasTimeDilation && (
                <AbilityButton 
                    icon={Clock} 
                    isActive={isTimeDilationActive}
                    cooldownStart={cooldowns.time}
                    duration={COOLDOWN_DURATIONS.time}
                    activeDuration={ABILITY_DURATIONS.time}
                    onClick={activateTimeDilation}
                    themeColor={themeColor}
                    hotkey="Q"
                />
            )}
            {hasMagnet && (
                <AbilityButton 
                    icon={Magnet} 
                    isActive={isMagnetActive}
                    cooldownStart={cooldowns.magnet}
                    duration={COOLDOWN_DURATIONS.magnet}
                    activeDuration={ABILITY_DURATIONS.magnet}
                    onClick={activateMagnet}
                    themeColor={themeColor}
                    hotkey="E"
                />
            )}
            {hasImmortality && (
                <AbilityButton 
                    icon={Lock} 
                    isActive={isImmortalityActive}
                    cooldownStart={cooldowns.ghost}
                    duration={COOLDOWN_DURATIONS.ghost}
                    activeDuration={ABILITY_DURATIONS.ghost}
                    onClick={activateImmortality}
                    themeColor={themeColor}
                    hotkey="R"
                />
            )}
        </div>

         {/* Near Miss */}
         {nearMissActive && (
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div 
                    className="text-white font-black text-4xl font-cyber tracking-tighter border-y-2 border-white bg-black/80 px-6 py-2"
                    style={{ borderColor: themeColor, color: themeColor }}
                >
                    DODGE
                </div>
            </div>
        )}

        {/* Letters - Hide if Boss Level */}
        {!currentLevelConfig.hasBoss && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 flex space-x-1 mt-[env(safe-area-inset-top)]">
                {target.map((char, idx) => {
                    const isCollected = collectedLetters.includes(idx);
                    const color = SNEAKY_COLORS[idx];
                    return (
                        <div 
                            key={idx}
                            style={{
                                borderColor: isCollected ? color : '#222',
                                color: isCollected ? color : '#333',
                                background: isCollected ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
                                textShadow: isCollected ? `0 0 10px ${color}` : 'none'
                            }}
                            className={`w-8 h-10 md:w-10 md:h-12 flex items-center justify-center border font-bold text-lg md:text-xl font-mono transition-all duration-300`}
                        >
                            {char}
                        </div>
                    );
                })}
            </div>
        )}

        {/* Bottom Stats */}
        <div className="w-full flex justify-end items-end text-xs font-mono text-gray-600 tracking-widest pointer-events-none">
             <div className="text-right">
                 <div><span className="text-gray-500">DIST::</span> {Math.floor(distance)}</div>
                 <div><span className="text-gray-500">SPEED::</span> {Math.round((speed / RUN_SPEED_BASE) * 100)}%</div>
             </div>
        </div>
    </div>
  );
};