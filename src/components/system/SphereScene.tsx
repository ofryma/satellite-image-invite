import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import Earth from './Earth';
import Moon from './Moon';
import Sun from './Sun';

export default function SphereScene() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [15, 5, 15] }} style={{ background: '#000000' }}>
        {/* Minimal ambient light for base visibility */}
        <ambientLight intensity={0.1} />
        
        {/* Add stars to the background */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.2} />
        
        {/* Celestial bodies */}
        <Sun />
        <Earth />
        <Moon />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>
    </div>
  );
} 