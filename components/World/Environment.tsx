/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH } from '../../types';

/* ======================================================
   REACTIVE CITY (ADAPTS TO LEVEL THEME)
====================================================== */

const ReactiveCity: React.FC<{ color: string, secondaryColor: string }> = ({ color, secondaryColor }) => {
  const { speed } = useStore();
  const buildingRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COUNT = 120; // Optimized count for mobile

  const blocks = useMemo(() => {
    return new Array(COUNT).fill(0).map((_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        x: side * (25 + Math.random() * 30),
        z: -350 + Math.random() * 350,
        h: 20 + Math.random() * 80,
        w: 5 + Math.random() * 10,
        d: 5 + Math.random() * 10,
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (!buildingRef.current) return;
    const v = Math.max(speed, 10);

    blocks.forEach((b, i) => {
      b.z += v * delta * 0.8;
      if (b.z > 50) {
        b.z = -400 - Math.random() * 50;
        b.h = 20 + Math.random() * 80; // Reshuffle height
      }

      dummy.position.set(b.x, b.h / 2 - 5, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      buildingRef.current!.setMatrixAt(i, dummy.matrix);
    });

    buildingRef.current.instanceMatrix.needsUpdate = true;
  });

  const material = useMemo(() => {
      return new THREE.MeshStandardMaterial({
          color: '#050505',
          emissive: color,
          emissiveIntensity: 0.1,
          roughness: 0.1,
          metalness: 0.8
      });
  }, [color]);

  return (
    <instancedMesh ref={buildingRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
};

/* ======================================================
   SPEED LINES (ANIME STYLE)
====================================================== */

const SpeedLines: React.FC<{ color: string }> = ({ color }) => {
  const { speed } = useStore();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COUNT = 100;

  const streaks = useMemo(() => {
    return new Array(COUNT).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 100,
      y: Math.random() * 40,
      z: -200 + Math.random() * 200,
      len: 20 + Math.random() * 40,
      speedMult: 1 + Math.random(),
    }));
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const v = Math.max(speed * 4, 60);

    streaks.forEach((s, i) => {
      s.z += v * delta * s.speedMult;
      if (s.z > 20) {
        s.z = -300 - Math.random() * 100;
        s.x = (Math.random() - 0.5) * 100;
      }
      
      // Face camera ish
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(0.05, 0.05, s.len);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

/* ======================================================
   SOLID CYBER ROAD (PREMIUM FEEL)
====================================================== */

const CyberRoad: React.FC<{ color: string, laneCount: number }> = ({ color, laneCount }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { speed } = useStore();
    const offset = useRef(0);
    
    // Ensure road is always wide enough even for max lanes, plus margins
    const totalWidth = Math.max((laneCount * LANE_WIDTH), 20) + 10; 

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(color) },
                uTime: { value: 0 },
                uWidth: { value: totalWidth },
                uLaneCount: { value: laneCount },
                uLaneWidth: { value: LANE_WIDTH },
                uFogColor: { value: new THREE.Color('#000000') },
                uFogNear: { value: 50 }, // Pushed back to prevent clipping with camera
                uFogFar: { value: 200 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPos;
                void main() {
                    vUv = uv;
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uWidth;
                uniform float uLaneWidth;
                uniform vec3 uFogColor;
                uniform float uFogNear;
                uniform float uFogFar;
                
                varying vec2 vUv;
                varying vec3 vPos;
                
                void main() {
                    // Coordinates in world scale (approx)
                    float worldX = (vUv.x - 0.5) * uWidth;
                    float scrollY = vUv.y * 200.0 - uTime * 20.0;
                    
                    // Base Asphalt Color
                    vec3 roadColor = vec3(0.08, 0.08, 0.1);
                    
                    // Subtle Noise/Grain (simulated)
                    float noise = fract(sin(dot(vUv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
                    roadColor += noise * 0.02;

                    // Lane Markers
                    // Calculate distance to nearest lane center
                    float laneDist = abs(mod(worldX + uLaneWidth * 0.5, uLaneWidth) - uLaneWidth * 0.5);
                    float isMarker = 1.0 - smoothstep(0.05, 0.08, laneDist); // Thin line
                    
                    // Dash pattern for markers
                    float dash = step(0.5, fract(scrollY * 0.1));
                    
                    // Combine Marker: Only draw markers within the active road area
                    float roadExtent = (uLaneWidth * 7.0) * 0.5; // Max potential width
                    float activeRoad = 1.0 - smoothstep(roadExtent - 1.0, roadExtent, abs(worldX));

                    // Glow Effect
                    vec3 markerColor = uColor * 2.0;
                    roadColor = mix(roadColor, markerColor, isMarker * dash * 0.5 * activeRoad);

                    // Road Edges (Solid Glow)
                    float edgeDist = abs(worldX) - ((uLaneWidth * 7.0) * 0.5); // Fixed visual width for consistency
                    float isEdge = 1.0 - smoothstep(0.0, 0.2, abs(edgeDist));
                    
                    if (edgeDist < 0.0 && edgeDist > -0.2) {
                        roadColor = mix(roadColor, uColor * 3.0, 0.8);
                    }

                    // Forward Grid Lines (Speed sensation)
                    float gridY = step(0.98, fract(scrollY * 0.05)); // Distant horizontal lines
                    roadColor += uColor * gridY * 0.1;

                    // Manual Linear Fog
                    float depth = gl_FragCoord.z / gl_FragCoord.w;
                    float fogFactor = smoothstep(uFogNear, uFogFar, depth);
                    
                    gl_FragColor = vec4(mix(roadColor, uFogColor, fogFactor), 1.0);
                }
            `,
            transparent: false,
        });
    }, [color, totalWidth]);

    useFrame((state, delta) => {
        if (meshRef.current) {
            const mat = meshRef.current.material as THREE.ShaderMaterial;
            offset.current += speed * delta;
            mat.uniforms.uTime.value = offset.current;
            mat.uniforms.uColor.value.set(color);
            mat.uniforms.uFogColor.value.set(state.scene.background || '#000000');
        }
    });

    return (
        <group position={[0, -0.1, -50]} rotation={[-Math.PI/2, 0, 0]}>
            {/* The Road Surface */}
            <mesh ref={meshRef} key={laneCount}> {/* Key forces rebuild on lane count change */}
                <planeGeometry args={[totalWidth, 400]} />
                <primitive object={material} attach="material" />
            </mesh>
            {/* Underside / Side glow fake */}
            <mesh position={[0, 0, 0.5]}>
                 <planeGeometry args={[totalWidth + 2, 400]} />
                 <meshBasicMaterial color="#000" />
            </mesh>
        </group>
    );
};

/* ======================================================
   MAIN ENVIRONMENT CONTROLLER
====================================================== */

export const Environment: React.FC = () => {
  const { currentLevelConfig } = useStore();
  const { scene } = useThree();
  
  // Update Fog and Background based on Level Theme
  useEffect(() => {
      const theme = currentLevelConfig.theme;
      scene.background = new THREE.Color(theme.sky);
      // Fog matches sky to blend horizon seamlessly, pushed back to 50
      scene.fog = new THREE.Fog(theme.sky, 50, 200); 
  }, [currentLevelConfig, scene]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} color={currentLevelConfig.theme.primary} />
      
      <ReactiveCity 
        color={currentLevelConfig.theme.primary} 
        secondaryColor={currentLevelConfig.theme.secondary} 
      />
      
      <SpeedLines color={currentLevelConfig.theme.primary} />
      
      <CyberRoad 
        color={currentLevelConfig.theme.grid} 
        laneCount={currentLevelConfig.lanes} 
      />
    </>
  );
};