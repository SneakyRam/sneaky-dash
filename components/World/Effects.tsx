/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useMemo } from 'react';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useThree } from '@react-three/fiber';

export const Effects: React.FC = () => {
  const { size } = useThree();
  
  // Detect mobile simply via width or user agent approximation for performance tuning
  const isMobile = useMemo(() => {
      return size.width < 768;
  }, [size.width]);

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {/* 
         Bloom:
         - Mobile: Lower intensity, slightly tighter radius to save fill-rate.
         - Desktop: Full cinematic bloom.
      */}
      <Bloom 
        luminanceThreshold={0.75} 
        mipmapBlur 
        intensity={isMobile ? 0.8 : 1.0} 
        radius={isMobile ? 0.5 : 0.6}
        levels={isMobile ? 4 : 8} // Reduce levels on mobile for performance
      />
      
      {/* 
         Noise & Vignette:
         - Disable on mobile to ensure stable 60fps.
         - These are subtle effects that are expensive to render on weak GPUs.
      */}
      {!isMobile && (
        <>
            <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </>
      )}
    </EffectComposer>
  );
};