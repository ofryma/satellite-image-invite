import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, PointLight, Color, TextureLoader } from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

interface SunProps {
  position?: [number, number, number];
}

export default function Sun({ position = [-30, 0, -30] }: SunProps) {
  const sunRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  
  useEffect(() => {
    if (lightRef.current) {
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.15);
      dirLight.position.set(...position);
      dirLight.color.setHSL(0.1, 0.5, 0.9);
    
      const textureLoader = new THREE.TextureLoader();
      const lensflare = new Lensflare();

      // Add a single, large lens flare element
      lensflare.addElement(new LensflareElement(
        textureLoader.load("/assets/textures/lensflare0_alpha.png"),
        1500, // larger size  
        0,
        new THREE.Color(1, 0.85, 0.6)
      ));

      lightRef.current.add(lensflare);
      lightRef.current.add(dirLight);
    }
  }, []);

  useFrame((state, delta) => {
    if (sunRef.current) {
      // Slow rotation for the sun
      sunRef.current.rotation.y += delta * 0.1;
    }
  });

  // Sun is much larger than Earth (109 times), but we'll use a smaller scale for visualization
  const sunSize = 5; // Scaled down for visualization

  return (
    <group position={position}>
      {/* Sun mesh */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[sunSize, 64, 64]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      
      {/* Sun's light */}
      <pointLight
        ref={lightRef}
        color="#FFF"
        intensity={90}
        distance={300}
        decay={1}
      />
    </group>
  );
} 