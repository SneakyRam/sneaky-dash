/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, SNEAKY_COLORS, ObstacleVariant } from '../../types';
import { audio } from '../System/Audio';
import { eventBus } from '../System/EventBus';

// --- GEOMETRIES ---

// 1. HIGH BEAM 
const BEAM_GEO = new THREE.BoxGeometry(2.4, 0.6, 0.6); 
const BEAM_POLE_GEO = new THREE.BoxGeometry(0.3, 4.0, 0.3);

// 2. FIREWALL BLOCK 
const WALL_GEO = new THREE.BoxGeometry(2.0, 3.5, 1.0);
const WALL_FRAME_GEO = new THREE.BoxGeometry(2.1, 3.6, 1.1);

// 3. DATA PILLAR 
const DATA_PILLAR_GEO = new THREE.BoxGeometry(1.5, 4.0, 1.5);

// Collectibles
const GEM_GEOMETRY = new THREE.OctahedronGeometry(0.35, 0); 
const VIRUS_GEOMETRY = new THREE.IcosahedronGeometry(0.4, 1);

// Enemies
const ALIEN_BODY_GEO = new THREE.IcosahedronGeometry(0.5, 0); 
const ALIEN_WING_GEO = new THREE.BoxGeometry(0.1, 0.8, 0.6); 
const MISSILE_CORE_GEO = new THREE.BoxGeometry(0.15, 0.15, 0.8);

// Boss
const BOSS_CORE_GEO = new THREE.OctahedronGeometry(2, 0);
const BOSS_RING_GEO = new THREE.TorusGeometry(3, 0.2, 16, 100);

// Shop
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1);

// Shadows
const SHADOW_SQUARE_GEO = new THREE.PlaneGeometry(1.5, 1.5);

const PARTICLE_COUNT = 400;
const BASE_LETTER_INTERVAL = 150; 
const BOSS_Z_OFFSET = -25; // How far in front of player the boss hovers

const getLetterInterval = (levelIdx: number) => {
    return BASE_LETTER_INTERVAL * Math.pow(1.5, Math.max(0, levelIdx));
};

const MISSILE_SPEED = 30;

const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (data: { position: number[], color: string }) => {
            const { position, color } = data;
            let spawned = 0;
            const burstAmount = 40; 
            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0; 
                    p.pos.set(position[0], position[1], position[2]);
                    const speed = 10 + Math.random() * 10; 
                    p.vel.set((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
                    p.rot.set(Math.random(), Math.random(), Math.random());
                    p.color.set(color);
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        eventBus.on('particle-burst', handleExplosion);
        return () => eventBus.off('particle-burst', handleExplosion);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= delta * 3.0; 
                p.pos.addScaledVector(p.vel, delta);
                dummy.position.copy(p.pos);
                const scale = p.life * p.life * 0.4;
                dummy.scale.set(scale, scale, scale);
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { 
    status, speed, collectGem, collectLetter, collectedLetters,
    laneCount, setDistance, openShop, levelIndex, currentLevelConfig,
    addScore, isSliding, damageBoss, timeScale, isMagnetActive
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevelIdx = useRef(levelIndex);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = levelIndex !== prevLevelIdx.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(0);
    } else if (isLevelUp) {
        // Clear distant objects, maybe spawn shop if not boss level
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
        
        if (!currentLevelConfig.hasBoss) {
            objectsRef.current.push({
                id: uuidv4(),
                type: ObjectType.SHOP_PORTAL,
                position: [0, 0, -100], 
                active: true,
            });
        }
        
        nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(levelIndex);
        setRenderTrigger(t => t + 1);
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    prevStatus.current = status;
    prevLevelIdx.current = levelIndex;
  }, [status, levelIndex, setDistance, currentLevelConfig]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) playerObjRef.current = group.children[0];
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;
    const safeDelta = Math.min(delta, 0.05); 
    
    // Apply Time Scale to World Movement
    const dist = speed * timeScale * safeDelta;
    distanceTraveled.current += dist;

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    if (playerObjRef.current) playerObjRef.current.getWorldPosition(playerPos);

    // --- BOSS LOGIC ---
    if (currentLevelConfig.hasBoss) {
        const existingBoss = objectsRef.current.find(o => o.type === ObjectType.BOSS);
        if (!existingBoss) {
            objectsRef.current.push({
                id: 'THE_BOSS',
                type: ObjectType.BOSS,
                position: [0, 4, BOSS_Z_OFFSET], 
                active: true
            });
            hasChanges = true;
        } else {
            existingBoss.position[2] = -35; 
            existingBoss.position[0] = Math.sin(state.clock.elapsedTime * 0.5) * 5; 
        }
    }

    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    for (const obj of currentObjects) {
        // Boss stays managed manually above
        if (obj.type === ObjectType.BOSS) {
            keptObjects.push(obj);
            continue;
        }

        let moveAmount = dist;
        // Missiles also affected by time scale
        if (obj.type === ObjectType.MISSILE) moveAmount += MISSILE_SPEED * timeScale * safeDelta;

        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;
        
        // --- MAGNET LOGIC ---
        if (isMagnetActive && obj.active && (obj.type === ObjectType.GEM || obj.type === ObjectType.LETTER || obj.type === ObjectType.VIRUS)) {
            // Check distance
            const dx = playerPos.x - obj.position[0];
            const dz = playerPos.z - obj.position[2];
            const distanceToPlayer = Math.sqrt(dx*dx + dz*dz);
            
            if (distanceToPlayer < 25) { // Magnet Range
                 // Lerp towards player
                 obj.position[0] += dx * 5 * safeDelta;
                 obj.position[2] += dz * 5 * safeDelta;
            }
        }
        
        // Alien Shooting Logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], 
                     active: true,
                     color: '#ff0000'
                 });
                 hasChanges = true;
             }
        }

        let keep = true;
        if (obj.active) {
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
            if (obj.type === ObjectType.SHOP_PORTAL) {
                const dz = Math.abs(obj.position[2] - playerPos.z);
                if (dz < 2) { 
                     openShop();
                     obj.active = false;
                     hasChanges = true;
                     keep = false; 
                }
            } else if (inZZone) {
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) { 
                     // COLLISION
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                     
                     if (isDamageSource) {
                         // ... (Hitbox logic similar to before) ...
                         const playerBottom = playerPos.y; 
                         const playerTop = playerPos.y + 1.8;
                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;

                         if (obj.type === ObjectType.OBSTACLE) {
                             if (obj.variant === ObstacleVariant.WALL) { objBottom = 0; objTop = 3.5; } 
                             else if (obj.variant === ObstacleVariant.BARREL) { objBottom = 0; objTop = 4.0; } 
                             else if (obj.variant === ObstacleVariant.BEAM) { objBottom = 1.3; objTop = 2.0; }
                         } else if (obj.type === ObjectType.MISSILE) {
                             objBottom = 0.5; objTop = 1.5;
                         }

                         let effectivePlayerTop = playerTop;
                         if (isSliding && !playerPos.y) effectivePlayerTop = 0.8;

                         const isHit = (playerBottom < objTop) && (effectivePlayerTop > objBottom);

                         if (isHit) { 
                             eventBus.emit('player-hit');
                             obj.active = false; 
                             hasChanges = true;
                             eventBus.emit('particle-burst', { position: obj.position, color: '#ff0000' });
                         }
                     } else {
                         // COLLECTIBLE
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         if (dy < 2.5) { 
                            if (obj.type === ObjectType.GEM) {
                                collectGem(obj.points || 50);
                                audio.playGemCollect();
                            }
                            if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                                collectLetter(obj.targetIndex);
                                audio.playLetterCollect();
                            }
                            if (obj.type === ObjectType.VIRUS) {
                                damageBoss(10); // 10% damage
                                audio.playGemCollect(); // Reuse sound
                            }
                            eventBus.emit('particle-burst', { position: obj.position, color: '#00f0ff' });
                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                } else if (dx < 2.0 && !obj.hasNearMissed) {
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                     if (isDamageSource) {
                         obj.hasNearMissed = true;
                         addScore(50);
                         eventBus.emit('near-miss');
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) keptObjects.push(obj);
    }

    if (newSpawns.length > 0) keptObjects.push(...newSpawns);

    // --- SPAWN LOGIC ---
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE && o.type !== ObjectType.BOSS);
    if (staticObjects.length > 0) furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    else furthestZ = -20;

    if (furthestZ > -SPAWN_DISTANCE) {
         const minGap = 15 + (speed * timeScale * 0.4); // Scale gap with timeScale to maintain density
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         // 1. Check for Letters / Virus
         const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

         if (isLetterDue) {
             const lane = getRandomLane(laneCount);
             
             if (currentLevelConfig.hasBoss) {
                 // Spawn Virus instead of Letter
                 keptObjects.push({
                     id: uuidv4(), type: ObjectType.VIRUS, position: [lane * LANE_WIDTH, 1.2, spawnZ], active: true, color: '#00ff00'
                 });
                 nextLetterDistance.current += 100; // Frequent virus spawns
                 hasChanges = true;
             } else {
                 const target = ['S','N','E','A','K','Y'];
                 const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));
                 if (availableIndices.length > 0) {
                     const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                     const val = target[chosenIndex];
                     const color = SNEAKY_COLORS[chosenIndex];
                     keptObjects.push({
                        id: uuidv4(), type: ObjectType.LETTER, position: [lane * LANE_WIDTH, 1.0, spawnZ], active: true, color: color, value: val, targetIndex: chosenIndex
                     });
                     nextLetterDistance.current += getLetterInterval(levelIndex);
                     hasChanges = true;
                 } else {
                    // All letters collected? Spawn Gem
                    keptObjects.push({
                        id: uuidv4(), type: ObjectType.GEM, position: [lane * LANE_WIDTH, 1.2, spawnZ], active: true, color: '#00f0ff', points: 50
                    });
                    hasChanges = true;
                 }
             }
         } else if (Math.random() > 0.15) {
            // 2. Obstacle / Enemy Spawn
            const isObstacle = Math.random() > 0.25;
            
            if (isObstacle) {
                const spawnAlien = currentLevelConfig.enemies.aliens && Math.random() < 0.3; 
                
                if (spawnAlien) {
                    const lane = getRandomLane(laneCount);
                    keptObjects.push({
                        id: uuidv4(), type: ObjectType.ALIEN, position: [lane * LANE_WIDTH, 1.5, spawnZ], active: true, color: '#ff003c', hasFired: false
                    });
                } else {
                    const lane = getRandomLane(laneCount);
                    const rand = Math.random();
                    let variant = ObstacleVariant.BEAM; 
                    
                    if (rand > 0.6) variant = ObstacleVariant.WALL; 
                    else if (rand > 0.3) variant = ObstacleVariant.BEAM;
                    else variant = ObstacleVariant.BARREL;
                    
                    let yPos = 0;
                    if (variant === ObstacleVariant.WALL) yPos = 1.75;
                    if (variant === ObstacleVariant.BARREL) yPos = 2.0; 
                    if (variant === ObstacleVariant.BEAM) yPos = 1.6; 
                    
                    keptObjects.push({
                        id: uuidv4(), type: ObjectType.OBSTACLE, variant: variant, position: [lane * LANE_WIDTH, yPos, spawnZ], active: true, color: '#ff003c'
                    });
                }
            } else {
                const lane = getRandomLane(laneCount);
                keptObjects.push({
                    id: uuidv4(), type: ObjectType.GEM, position: [lane * LANE_WIDTH, 1.2, spawnZ], active: true, color: '#00f0ff', points: 50
                });
            }
            hasChanges = true;
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const { laneCount, timeScale } = useStore();
    
    useFrame((state, delta) => {
        const scaledDelta = delta * timeScale; // Scale animation speed too
        
        if (groupRef.current) groupRef.current.position.set(data.position[0], 0, data.position[2]);
        if (visualRef.current) {
            const baseHeight = data.position[1];
            if (data.type === ObjectType.BOSS) {
                // Boss Hover Animation
                visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 0.8) * 1.5;
                visualRef.current.rotation.y += scaledDelta * 0.5;
                visualRef.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.1;
            } else if (data.type === ObjectType.MISSILE) {
                 visualRef.current.position.z += scaledDelta * 2; 
                 visualRef.current.position.y = baseHeight;
                 visualRef.current.rotation.z += scaledDelta * 10;
            } else if (data.type === ObjectType.ALIEN) {
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.2;
            } else if (data.type === ObjectType.OBSTACLE && data.variant === ObstacleVariant.BARREL) {
                 visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.02);
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.VIRUS) {
                visualRef.current.rotation.y += scaledDelta * 2;
                visualRef.current.rotation.x += scaledDelta * 2;
            } else if (data.type !== ObjectType.OBSTACLE) {
                visualRef.current.rotation.y += scaledDelta * 3;
                visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
            } else {
                visualRef.current.position.y = baseHeight;
            }
        }
    });

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && data.type !== ObjectType.BOSS && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={SHADOW_SQUARE_GEO}>
                    <meshBasicMaterial color={data.type === ObjectType.VIRUS ? "#00ff00" : "#00f0ff"} opacity={0.1} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                
                {/* --- BOSS RENDER --- */}
                {data.type === ObjectType.BOSS && (
                    <group scale={[2,2,2]}>
                        <mesh geometry={BOSS_CORE_GEO}>
                            <meshStandardMaterial color="#111" metalness={1} roughness={0} />
                        </mesh>
                        <mesh geometry={BOSS_CORE_GEO} scale={[1.1,1.1,1.1]}>
                            <meshBasicMaterial color="#ff0000" wireframe />
                        </mesh>
                        <mesh geometry={BOSS_RING_GEO} rotation={[Math.PI/2, 0, 0]}>
                            <meshStandardMaterial color="#330000" emissive="#ff0000" emissiveIntensity={0.5} />
                        </mesh>
                    </group>
                )}

                {/* --- VIRUS RENDER --- */}
                {data.type === ObjectType.VIRUS && (
                    <group>
                        <mesh geometry={VIRUS_GEOMETRY}>
                            <meshBasicMaterial color="#00ff00" wireframe />
                        </mesh>
                         <mesh geometry={new THREE.OctahedronGeometry(0.2, 0)}>
                            <meshBasicMaterial color="#00ff00" />
                        </mesh>
                    </group>
                )}

                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
                             <meshStandardMaterial color="#000" metalness={0.9} roughness={0.1} />
                         </mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2.1, 1.05, 1.05]}>
                             <meshBasicMaterial color="#00f0ff" wireframe />
                         </mesh>
                         <Center position={[0, 5, 0.6]}>
                             <Text3D font={FONT_URL} size={1.0} height={0.1}>
                                 DARK WEB
                                 <meshBasicMaterial color="#bf00ff" />
                             </Text3D>
                         </Center>
                    </group>
                )}

                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        {data.variant === ObstacleVariant.BEAM && (
                            <group>
                                <mesh geometry={BEAM_GEO}><meshStandardMaterial color="#111" /></mesh>
                                <mesh geometry={new THREE.BoxGeometry(2.5, 0.4, 0.7)}><meshBasicMaterial color="#ff0000" /></mesh>
                                <mesh position={[-1.2, -1.8, 0]} geometry={BEAM_POLE_GEO}><meshStandardMaterial color="#333" /></mesh>
                                <mesh position={[1.2, -1.8, 0]} geometry={BEAM_POLE_GEO}><meshStandardMaterial color="#333" /></mesh>
                            </group>
                        )}
                        {data.variant === ObstacleVariant.WALL && (
                            <group>
                                <mesh geometry={WALL_GEO}><meshStandardMaterial color="#111" roughness={0.2} metalness={0.8} /></mesh>
                                <mesh geometry={WALL_FRAME_GEO}><meshBasicMaterial color="#ff003c" wireframe /></mesh>
                                <mesh position={[0,0,0.51]}><planeGeometry args={[1.5, 3]} /><meshBasicMaterial color="#ff0000" transparent opacity={0.3} side={THREE.DoubleSide} /></mesh>
                            </group>
                        )}
                        {data.variant === ObstacleVariant.BARREL && (
                            <group>
                                <mesh geometry={DATA_PILLAR_GEO}><meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} /></mesh>
                                <mesh geometry={DATA_PILLAR_GEO} scale={[1.02, 1.02, 1.02]}><meshBasicMaterial color="#00ff00" wireframe opacity={0.5} transparent /></mesh>
                                <mesh geometry={new THREE.BoxGeometry(1.0, 3.8, 1.0)}><meshBasicMaterial color="#00ff00" transparent opacity={0.2} /></mesh>
                            </group>
                        )}
                    </group>
                )}

                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh geometry={ALIEN_BODY_GEO}><meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} /></mesh>
                        <mesh geometry={ALIEN_BODY_GEO} scale={[1.1, 1.1, 1.1]}><meshBasicMaterial color="#ff003c" wireframe transparent opacity={0.5} /></mesh>
                        <mesh position={[0.4, 0, 0]} geometry={ALIEN_WING_GEO}><meshBasicMaterial color="#ff003c" /></mesh>
                        <mesh position={[-0.4, 0, 0]} geometry={ALIEN_WING_GEO}><meshBasicMaterial color="#ff003c" /></mesh>
                    </group>
                )}

                {data.type === ObjectType.MISSILE && (
                     <mesh geometry={MISSILE_CORE_GEO}><meshBasicMaterial color="#ff003c" /></mesh>
                )}

                {data.type === ObjectType.GEM && (
                    <group>
                         <mesh geometry={GEM_GEOMETRY}>
                            <meshStandardMaterial color="#00f0ff" roughness={0} metalness={1} emissive="#00f0ff" emissiveIntensity={1} />
                        </mesh>
                        <mesh geometry={GEM_GEOMETRY} scale={[1.3, 1.3, 1.3]}>
                             <meshBasicMaterial color="#fff" wireframe opacity={0.5} transparent />
                        </mesh>
                    </group>
                )}

                {data.type === ObjectType.LETTER && (
                    <group scale={[1.5, 1.5, 1.5]}>
                         <Center>
                             <Text3D font={FONT_URL} size={0.8} height={0.2}>
                                {data.value}
                                <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} />
                             </Text3D>
                         </Center>
                    </group>
                )}
            </group>
        </group>
    );
});