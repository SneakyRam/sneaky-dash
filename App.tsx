/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { Suspense, useRef, useEffect, useMemo, lazy } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HUD } from './components/UI/HUD';
import { useStore } from './store';
import { RUN_SPEED_BASE, GameStatus } from './types';
import { eventBus } from './components/System/EventBus';

const Scene = lazy(() => import('./components/World/Scene'));

// Dynamic Camera Controller
const CameraController = () => {
  const { camera, size } = useThree();
  const { laneCount, speed, status } = useStore();
  const shakeIntensity = useRef(0);
  
  // Cinematic Drift Refs
  const menuTime = useRef(0);

  useEffect(() => {
      const onImpact = (data: { intensity: number }) => {
          shakeIntensity.current = data.intensity;
      };
      eventBus.on('camera-impact', onImpact);
      return () => eventBus.off('camera-impact', onImpact);
  }, []);

  useFrame((state, delta) => {
    // Determine if screen is narrow (mobile portrait)
    const aspect = size.width / size.height;
    const isMobile = aspect < 1.0; 

    // --- MENU STATE: CINEMATIC COMPOSITION ---
    if (status === GameStatus.MENU) {
        menuTime.current += delta;
        const t = menuTime.current;
        
        // Slight drift for life
        const driftX = Math.sin(t * 0.2) * 0.2;
        const driftY = Math.cos(t * 0.15) * 0.1;

        let targetPos, targetLook;

        if (isMobile) {
            // MOBILE: Camera looks DOWN at player, player at BOTTOM
            // Text will be at top.
            // Pos: High up, centered X.
            // Look: Point ABOVE the player so player slides down.
            targetPos = new THREE.Vector3(0 + driftX, 3.5 + driftY, 6.5);
            targetLook = new THREE.Vector3(0, 2.5, 0); // Look at a point above the player
        } else {
            // DESKTOP: Camera looks RIGHT at player, player at RIGHT
            // Text will be on left.
            // Pos: Shifted slightly positive X (right), Z back.
            // Look: Look at a point to the LEFT of the player (-X) so player shifts Right.
            targetPos = new THREE.Vector3(1.5 + driftX, 1.6 + driftY, 4.8);
            targetLook = new THREE.Vector3(-2.5, 0.9, 0); // Look at empty space on left
        }

        camera.position.lerp(targetPos, delta * 2.0);
        
        // Manual LookAt Lerp implementation to avoid snapping
        const currentLook = new THREE.Vector3();
        camera.getWorldDirection(currentLook);
        const desiredDir = new THREE.Vector3().subVectors(targetLook, camera.position).normalize();
        
        // Smoothly blend direction
        const smoothDir = currentLook.lerp(desiredDir, delta * 2.0);
        const lookAtPos = new THREE.Vector3().addVectors(camera.position, smoothDir);
        camera.lookAt(lookAtPos);
        
        // Reset FOV for cinematic feel
        if ((camera as THREE.PerspectiveCamera).fov) {
            const targetFov = isMobile ? 65 : 45; // Wider on mobile to see more height
            (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, targetFov, delta);
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
        return;
    }

    // --- GAMEPLAY STATE ---

    // Calculate expansion factors for gameplay
    // Mobile: Needs to pull back more to see the road
    const heightFactor = isMobile ? 2.5 : 0.8;
    const distFactor = isMobile ? 6.0 : 1.5; // Increased distFactor for mobile to prevent clipping on jumps

    // Base (3 lanes): y=5.5, z=8
    const extraLanes = Math.max(0, laneCount - 3);

    const targetY = 5.5 + (extraLanes * heightFactor);
    const targetZ = 8.0 + (extraLanes * distFactor);

    // Keep X at 0 for gameplay
    const gpTargetPos = new THREE.Vector3(0, targetY, targetZ);
    
    // Smoothly interpolate camera position - Increased speed for better transitions
    camera.position.lerp(gpTargetPos, delta * 4.0); 
    
    // Apply Shake
    if (shakeIntensity.current > 0) {
        const shake = shakeIntensity.current;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shakeIntensity.current = THREE.MathUtils.lerp(shake, 0, delta * 10);
        if (shakeIntensity.current < 0.01) shakeIntensity.current = 0;
    }

    // Speed-based FOV effect
    const speedRatio = speed / RUN_SPEED_BASE;
    const targetFOV = 60 + Math.max(0, (speedRatio - 1) * 15);
    
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
        (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, targetFOV, delta * 1.5);
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    
    // Look further down the track to see the end of lanes
    camera.lookAt(0, 0, -30); 
  });
  
  return null;
};



function App() {
  // Determine robust Pixel Ratio to balance sharpness vs performance
  // On mobile, cap at 1.0 to ensure 60fps with post-processing.
  const dpr = useMemo(() => {
     if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768;
        return isMobile ? [1, 1] : [1, 1.5];
     }
     return [1, 1];
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <HUD />
      <Canvas
        shadows
        dpr={dpr as [min: number, max: number]} 
        gl={{ 
            antialias: false, 
            stencil: false, 
            depth: true, 
            powerPreference: "high-performance" 
        }}
        // Initial camera will be overridden by controller immediately
        camera={{ position: [3, 2, 6], fov: 45 }}
      >
        <CameraController />
        <Suspense fallback={null}>
            <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;