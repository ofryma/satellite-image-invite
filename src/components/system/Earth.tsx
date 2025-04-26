import React, { useRef, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Mesh, TextureLoader, RepeatWrapping } from 'three';
import { sunPosAt } from '../earth/utils';

interface EarthProps {
  position?: [number, number, number];
}

export default function Earth({ position = [0, 0, 0] }: EarthProps) {
  const earthRef = useRef<Mesh>(null);
  
  // Load both the color and bump textures
  const [colorMap, bumpMap] = useLoader(TextureLoader, [
    '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    '//unpkg.com/three-globe/example/img/earth-topology.png'
  ]);

  useEffect(() => {
    if (colorMap && bumpMap) {
      colorMap.wrapS = colorMap.wrapT = RepeatWrapping;
      bumpMap.wrapS = bumpMap.wrapT = RepeatWrapping;
    }
  }, [colorMap, bumpMap]);

  useFrame(() => {
    if (earthRef.current) {
      // Calculate the current longitude based on UTC time
      const now = Date.now();
      const [longitude] = sunPosAt(now);
      // The Earth's rotation.y should match the longitude (converted to radians)
      earthRef.current.rotation.y = -longitude * (Math.PI / 180);
    }
  });

  return (
    <mesh ref={earthRef} position={position}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial 
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.1}
        metalness={0.2}
        roughness={0.8}
        emissive="#000000"
      />
    </mesh>
  );
} 