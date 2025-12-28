import React from 'react';
import { Environment } from './Environment';
import { Player } from './Player';
import { LevelManager } from './LevelManager';
import { Effects } from './Effects';

function Scene() {
  return (
    <>
        <Environment />
        <group>
            {/* Attach a userData to identify player group for LevelManager collision logic */}
            <group userData={{ isPlayer: true }} name="PlayerGroup">
                 <Player />
            </group>
            <LevelManager />
        </group>
        <Effects />
    </>
  );
}

export default Scene;
