/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, SLIDE_DURATION } from '../../types';
import { audio } from '../System/Audio';
import { eventBus } from '../System/EventBus';

/* ------------------ CONSTANTS ------------------ */

const GRAVITY = 60; 
const JUMP_FORCE = 17;

// -- ELITE GEOMETRY --
const TORSO_GEO = new THREE.BoxGeometry(0.35, 0.45, 0.25); 
const SPINE_GEO = new THREE.BoxGeometry(0.05, 0.35, 0.02); 
const ABDOMEN_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 8);
const HEAD_GEO = new THREE.BoxGeometry(0.22, 0.24, 0.26);
const VISOR_GEO = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16, 1, false, 0, Math.PI); 
const SHOULDER_GEO = new THREE.BoxGeometry(0.14, 0.14, 0.14);
const ARM_UPPER_GEO = new THREE.BoxGeometry(0.1, 0.25, 0.1);
const ARM_LOWER_GEO = new THREE.BoxGeometry(0.09, 0.25, 0.09);
const HAND_GEO = new THREE.BoxGeometry(0.08, 0.1, 0.08);
const HIP_GEO = new THREE.BoxGeometry(0.32, 0.15, 0.2);
const THIGH_GEO = new THREE.BoxGeometry(0.13, 0.35, 0.13);
const SHIN_GEO = new THREE.BoxGeometry(0.11, 0.35, 0.11);
const KNEE_PLATE_GEO = new THREE.BoxGeometry(0.14, 0.12, 0.05);
const BOOT_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.22);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 32);

// -- HAT GEOMETRY --
const HAT_GEO = new THREE.ConeGeometry(0.6, 0.15, 32);
const HAT_TOP_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16); 

/* ------------------ PLAYER ------------------ */

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null); // Main rotation root (tilt/slide)
  const shadowRef = useRef<THREE.Mesh>(null);
  const trailTargetRef = useRef<THREE.Group>(null); // Trail follows this

  // Limbs
  const headGroup = useRef<THREE.Group>(null);
  const leftArmGroup = useRef<THREE.Group>(null);
  const rightArmGroup = useRef<THREE.Group>(null);
  const leftLegGroup = useRef<THREE.Group>(null);
  const rightLegGroup = useRef<THREE.Group>(null);

  const { 
      status, laneCount, takeDamage, hasDoubleJump, setSliding, 
      activateImmortality, isImmortalityActive, currentLevelConfig,
      activateTimeDilation, activateMagnet 
  } = useStore();

  /* ------------------ STATE ------------------ */

  const [lane, setLane] = useState(0);

  const velocityY = useRef(0);
  const isJumping = useRef(false);
  const jumps = useRef(0);

  const isSliding = useRef(false);
  const slideTimer = useRef(0);

  /* Animation Smoothing */
  const smoothLaneX = useRef(0);
  const tiltX = useRef(0); // Forward/Back lean
  const tiltZ = useRef(0); // Banking
  const posY = useRef(1.1); // Visual height offset

  const invincible = useRef(false);
  const lastHit = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  /* ------------------ MATERIALS ------------------ */
  
  const materials = useMemo(() => {
    // Universal Elite Palette
    const graphite = new THREE.MeshStandardMaterial({
        color: '#111111',
        roughness: 0.9, 
        metalness: 0.1,
    });
    
    const gunmetal = new THREE.MeshStandardMaterial({
        color: '#2a2c30',
        roughness: 0.4, 
        metalness: 0.6,
        envMapIntensity: 0.8
    });

    const visor = new THREE.MeshStandardMaterial({
        color: '#050505',
        roughness: 0.1, 
        metalness: 0.9,
    });

    const hat = new THREE.MeshStandardMaterial({
        color: '#1a1a1a',
        roughness: 0.8,
        metalness: 0.2,
        emissive: currentLevelConfig.theme.primary,
        emissiveIntensity: 0.5, 
    });

    const accent = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: currentLevelConfig.theme.primary, 
        emissiveIntensity: 1.5,
        toneMapped: false
    });

    const shadow = new THREE.MeshBasicMaterial({
        color: '#000',
        transparent: true,
        opacity: 0.4,
    });

    const shield = new THREE.MeshBasicMaterial({ 
          color: '#ffffff', 
          wireframe: true, 
          transparent: true, 
          opacity: 0.1 
    });

    return { graphite, gunmetal, visor, accent, shadow, shield, hat };
  }, [currentLevelConfig]);

  /* ------------------ INPUT ------------------ */

  const jump = () => {
    if (isSliding.current) return;

    const max = hasDoubleJump ? 2 : 1;
    if (!isJumping.current) {
      audio.playJump(false);
      isJumping.current = true;
      jumps.current = 1;
      velocityY.current = JUMP_FORCE;
    } else if (jumps.current < max) {
      audio.playJump(true);
      jumps.current++;
      velocityY.current = JUMP_FORCE;
    }
  };

  const slide = () => {
    if (isJumping.current || isSliding.current) return;
    isSliding.current = true;
    slideTimer.current = SLIDE_DURATION;
    setSliding(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);

      // Movement
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setLane(l => Math.max(l - 1, -maxLane));
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setLane(l => Math.min(l + 1, maxLane));
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') jump();
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') slide();
      
      // Skills
      if (e.key === 'q' || e.key === 'Q' || e.key === '1') activateTimeDilation();
      if (e.key === 'e' || e.key === 'E' || e.key === '2') activateMagnet();
      if (e.key === 'r' || e.key === 'R' || e.key === '3' || e.key === 'Enter') activateImmortality();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, laneCount, activateImmortality, activateMagnet, activateTimeDilation]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        // Lower threshold for responsiveness (20px instead of 30)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX)) {
            if (deltaY < -20) jump();
            if (deltaY > 20) slide();
        } 
        // Removed tap-to-activate to avoid accidental skill usage. Skills now use HUD buttons.
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount]);

  // RESET PHYSICS ON START OR LEVEL CHANGE
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumps.current = 0;
          velocityY.current = 0;
          isSliding.current = false;
          setSliding(false);
          setLane(0); // Center player on new level start
          smoothLaneX.current = 0;
          
          if (groupRef.current) {
              groupRef.current.position.y = 0;
              groupRef.current.position.x = 0;
          }
      }
  }, [status, currentLevelConfig, setSliding]);

  /* ------------------ FRAME LOOP ------------------ */

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // --- ANIMATION UPDATE ---
    const t = state.clock.elapsedTime * 20; 
    const slowTime = state.clock.elapsedTime;
    const leanSpeed = delta * 12;

    // Hat Pulse
    if (materials.hat) {
        materials.hat.emissive.set(currentLevelConfig.theme.primary);
        materials.hat.emissiveIntensity = 0.5 + Math.sin(slowTime * 10) * 0.5; // Faster pulse
    }
    if (materials.accent) {
         materials.accent.emissive.set(currentLevelConfig.theme.primary);
    }

    // MENU IDLE ANIMATION
    if (status === GameStatus.MENU) {
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, 0, delta * 5);
        if (visualRef.current) {
            visualRef.current.position.y = 1.1 + Math.sin(slowTime * 1.5) * 0.05;
            visualRef.current.rotation.set(0, 0.4, 0); 
        }
        return; 
    }

    /* 1. Physics & Position (PLAYING) */
    if (status === GameStatus.PLAYING) {
        const targetX = lane * LANE_WIDTH;
        smoothLaneX.current = THREE.MathUtils.lerp(smoothLaneX.current, targetX, delta * 15);
        groupRef.current.position.x = smoothLaneX.current;

        if (isJumping.current) {
            groupRef.current.position.y += velocityY.current * delta;
            velocityY.current -= GRAVITY * delta;
            if (groupRef.current.position.y <= 0) {
                groupRef.current.position.y = 0;
                isJumping.current = false;
                jumps.current = 0;
                velocityY.current = 0;
            }
        }
    }

    /* 2. Slide State */
    if (isSliding.current) {
      slideTimer.current -= delta;
      if (slideTimer.current <= 0) {
        isSliding.current = false;
        setSliding(false);
      }
    }

    /* 3. Run/Slide/Jump Poses */
    if (isSliding.current) {
        tiltX.current = THREE.MathUtils.lerp(tiltX.current, -Math.PI / 2 + 0.3, leanSpeed);
        posY.current = THREE.MathUtils.lerp(posY.current, 0.4, leanSpeed);
        
        // Compact limbs for slide
        if (leftArmGroup.current) leftArmGroup.current.rotation.x = -2.5;
        if (rightArmGroup.current) rightArmGroup.current.rotation.x = -2.5;
        if (leftLegGroup.current) leftLegGroup.current.rotation.x = -1.5;
        if (rightLegGroup.current) rightLegGroup.current.rotation.x = -1.5;
    } else {
        tiltX.current = THREE.MathUtils.lerp(tiltX.current, 0.15, leanSpeed); 
        posY.current = THREE.MathUtils.lerp(posY.current, 1.1, leanSpeed);
        
        // Run Cycle
        if (leftArmGroup.current) leftArmGroup.current.rotation.x = Math.sin(t) * 1.0;
        if (rightArmGroup.current) rightArmGroup.current.rotation.x = Math.sin(t + Math.PI) * 1.0;
        if (leftLegGroup.current) leftLegGroup.current.rotation.x = Math.sin(t + Math.PI) * 1.4;
        if (rightLegGroup.current) rightLegGroup.current.rotation.x = Math.sin(t) * 1.4;
    }

    // Apply Global Tilt - EXAGGERATED for Anime Feel
    if (status === GameStatus.PLAYING) {
        const targetX = lane * LANE_WIDTH;
        const bankAmt = -(targetX - groupRef.current.position.x) * 0.25; // More bank
        tiltZ.current = THREE.MathUtils.lerp(tiltZ.current, bankAmt, delta * 12);
    } else {
        tiltZ.current = 0;
    }
    
    if (visualRef.current) {
        visualRef.current.position.y = posY.current;
        visualRef.current.rotation.set(tiltX.current, 0, tiltZ.current);
    }

    /* 4. Shadow */
    const h = groupRef.current.position.y;
    if (shadowRef.current) {
        shadowRef.current.scale.setScalar(Math.max(0.3, 1 - h * 0.4));
        (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.4 - h * 0.2);
    }

    // Damage Flicker
    if (invincible.current) {
        if (Date.now() - lastHit.current > 1500) {
            invincible.current = false;
            groupRef.current.visible = true;
        } else {
            groupRef.current.visible = Math.floor(Date.now() / 30) % 2 === 0;
        }
    }
  });

  /* ------------------ DAMAGE ------------------ */

  useEffect(() => {
    const onHit = () => {
      if (invincible.current || isImmortalityActive) return;
      takeDamage();
      audio.playDamage();
      invincible.current = true;
      lastHit.current = Date.now();
      eventBus.emit('camera-impact', { intensity: 1.5 });
    };

    eventBus.on('player-hit', onHit);
    return () => eventBus.off('player-hit', onHit);
  }, [takeDamage, isImmortalityActive]);

  return (
    <group ref={groupRef}>
      
      {/* Light Trail (Tron Effect) */}
      {status === GameStatus.PLAYING && (
         <group position={[0, 0.5, 0]}>
             <Trail
                width={1.2}
                length={6}
                color={currentLevelConfig.theme.primary}
                attenuation={(t) => t * t}
             >
                 <mesh visible={false}>
                     <boxGeometry args={[0.1, 0.1, 0.1]} />
                 </mesh>
             </Trail>
         </group>
      )}

      {isImmortalityActive && (
          <mesh position={[0, 1.1, 0]}>
              <sphereGeometry args={[1.2, 16, 16]} />
              <primitive object={materials.shield} />
          </mesh>
      )}

      {/* Visual Root: Handles Slide & Tilt */}
      <group ref={visualRef} position={[0, 1.1, 0]}>
        
        {/* -- TORSO & HEAD -- */}
        <group>
            <mesh geometry={TORSO_GEO} material={materials.gunmetal} position={[0, 0.35, 0]} castShadow />
            <mesh geometry={SPINE_GEO} material={materials.accent} position={[0, 0.35, 0.13]} />
            <mesh geometry={new THREE.PlaneGeometry(0.1, 0.05)} material={materials.accent} position={[0, 0.4, -0.13]} rotation={[0, Math.PI, 0]} />
            <mesh geometry={ABDOMEN_GEO} material={materials.graphite} position={[0, 0, 0]} />
            <mesh geometry={HIP_GEO} material={materials.gunmetal} position={[0, -0.15, 0]} />

            {/* Head */}
            <group ref={headGroup} position={[0, 0.7, 0]}>
                 <mesh geometry={HEAD_GEO} material={materials.gunmetal} castShadow />
                 <mesh geometry={VISOR_GEO} material={materials.visor} rotation={[0, -Math.PI/2, 0]} position={[0, 0, -0.08]} />
                 
                 {/* TACTICAL STRAW HAT */}
                 <mesh 
                    geometry={HAT_GEO} 
                    material={materials.hat} 
                    position={[0, 0.18, 0]} 
                 />
                 <mesh 
                    geometry={HAT_TOP_GEO} 
                    material={materials.hat} 
                    position={[0, 0.26, 0]} 
                 />
            </group>
        </group>

        {/* -- ARMS -- */}
        <group ref={rightArmGroup} position={[0.26, 0.5, 0]}>
             <mesh geometry={SHOULDER_GEO} material={materials.gunmetal} />
             <mesh geometry={ARM_UPPER_GEO} material={materials.graphite} position={[0, -0.18, 0]} />
             <mesh geometry={ARM_LOWER_GEO} material={materials.gunmetal} position={[0, -0.45, 0]} />
             <mesh geometry={HAND_GEO} material={materials.graphite} position={[0, -0.62, 0]} />
        </group>

        <group ref={leftArmGroup} position={[-0.26, 0.5, 0]}>
             <mesh geometry={SHOULDER_GEO} material={materials.gunmetal} />
             <mesh geometry={ARM_UPPER_GEO} material={materials.graphite} position={[0, -0.18, 0]} />
             <mesh geometry={ARM_LOWER_GEO} material={materials.gunmetal} position={[0, -0.45, 0]} />
             <mesh geometry={HAND_GEO} material={materials.graphite} position={[0, -0.62, 0]} />
        </group>

        {/* -- LEGS -- */}
        <group ref={rightLegGroup} position={[0.12, -0.22, 0]}>
             <mesh geometry={THIGH_GEO} material={materials.graphite} position={[0, -0.2, 0]} />
             <mesh geometry={KNEE_PLATE_GEO} material={materials.gunmetal} position={[0, -0.35, 0.08]} />
             <mesh geometry={SHIN_GEO} material={materials.gunmetal} position={[0, -0.6, 0]} />
             <mesh geometry={BOOT_GEO} material={materials.graphite} position={[0, -0.85, 0]} />
        </group>

        <group ref={leftLegGroup} position={[-0.12, -0.22, 0]}>
             <mesh geometry={THIGH_GEO} material={materials.graphite} position={[0, -0.2, 0]} />
             <mesh geometry={KNEE_PLATE_GEO} material={materials.gunmetal} position={[0, -0.35, 0.08]} />
             <mesh geometry={SHIN_GEO} material={materials.gunmetal} position={[0, -0.6, 0]} />
             <mesh geometry={BOOT_GEO} material={materials.graphite} position={[0, -0.85, 0]} />
        </group>
      </group>

      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        geometry={SHADOW_GEO}
        material={materials.shadow}
      />
    </group>
  );
};