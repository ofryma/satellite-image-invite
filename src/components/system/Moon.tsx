import React, { useRef, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Mesh, Group, TextureLoader, RepeatWrapping } from 'three';

interface MoonProps {
  position?: [number, number, number];
}

export default function Moon({ position = [0, 0, 0] }: MoonProps) {
  const moonRef = useRef<Mesh>(null);
  const orbitRef = useRef<Group>(null);
  
  // Load the lunar surface texture
  const moonTexture = useLoader(TextureLoader, 'assets/materials/lunar_surface.jpg');

  useEffect(() => {
    if (moonTexture) {
      moonTexture.wrapS = moonTexture.wrapT = RepeatWrapping;
    }
  }, [moonTexture]);

  useFrame((state, delta) => {
    if (moonRef.current && orbitRef.current) {
      // Moon rotates around its axis
      moonRef.current.rotation.y += delta * 0.1;
      // Moon orbits around the Earth
      orbitRef.current.rotation.y += delta * 0.05;
    }
  });

  // The Moon's diameter is about 27% of Earth's
  const moonSize = 0.54; // 2 (Earth size) * 0.27
  // Average distance from Earth is about 30 Earth diameters
  const orbitRadius = 6;

  return (
    <group ref={orbitRef}>
      <mesh 
        ref={moonRef} 
        position={[orbitRadius, 0, 0]}
      >
        <sphereGeometry args={[moonSize, 64, 64]} />
        <meshStandardMaterial 
          map={moonTexture}
          metalness={0.1}
          roughness={0.9}
          emissive="#000000"
        />
      </mesh>
    </group>
  );
} 