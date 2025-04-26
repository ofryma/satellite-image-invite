import React, { useState, useEffect, useCallback, useRef } from 'react';
import Globe from "react-globe.gl";
import { GlobeMethods } from "react-globe.gl";
import { TextureLoader, ShaderMaterial, Vector2 } from 'three';
import * as solar from 'solar-calculator';

const VELOCITY = 0.1; // minutes per frame
// Custom shader:  Blends night and day images to simulate day/night cycle
const dayNightShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #define PI 3.141592653589793
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec2 sunPosition;
      uniform vec2 globeRotation;
      varying vec3 vNormal;
      varying vec2 vUv;

      float toRad(in float a) {
        return a * PI / 180.0;
      }

      vec3 Polar2Cartesian(in vec2 c) { // [lng, lat]
        float theta = toRad(90.0 - c.x);
        float phi = toRad(90.0 - c.y);
        return vec3( // x,y,z
          sin(phi) * cos(theta),
          cos(phi),
          sin(phi) * sin(theta)
        );
      }

      void main() {
        float invLon = toRad(globeRotation.x);
        float invLat = -toRad(globeRotation.y);
        mat3 rotX = mat3(
          1, 0, 0,
          0, cos(invLat), -sin(invLat),
          0, sin(invLat), cos(invLat)
        );
        mat3 rotY = mat3(
          cos(invLon), 0, sin(invLon),
          0, 1, 0,
          -sin(invLon), 0, cos(invLon)
        );
        vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
        float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
        vec4 dayColor = texture2D(dayTexture, vUv);
        vec4 nightColor = texture2D(nightTexture, vUv);
        float blendFactor = smoothstep(-0.1, 0.1, intensity);
        gl_FragColor = mix(nightColor, dayColor, blendFactor);
      }
    `
};

const sunPosAt = (dt: number): [number, number] => {
    const day = new Date(+dt).setUTCHours(0, 0, 0, 0);
    const t = solar.century(dt);
    const longitude = (day - dt) / 864e5 * 360 - 180;
    return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
};

const EarthSimulator = () => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    const [rotation, setRotation] = useState<boolean>(false);
    const [rotationSpeed, setRotationSpeed] = useState<number>(0.2);
    const [dt, setDt] = useState<number>(+new Date());
    const [globeMaterial, setGlobeMaterial] = useState<ShaderMaterial | undefined>();
    const [desiredDt, setDesiredDt] = useState<number>(+new Date());

    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = rotation;
            globeRef.current.controls().autoRotateSpeed = rotationSpeed;
        }
    }, [rotation, rotationSpeed]);

    useEffect(() => {
        Promise.all([
            new TextureLoader().loadAsync('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg'),
            new TextureLoader().loadAsync('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
        ]).then(([dayTexture, nightTexture]) => {
            setGlobeMaterial(new ShaderMaterial({
                uniforms: {
                    dayTexture: { value: dayTexture },
                    nightTexture: { value: nightTexture },
                    sunPosition: { value: new Vector2() },
                    globeRotation: { value: new Vector2() }
                },
                vertexShader: dayNightShader.vertexShader,
                fragmentShader: dayNightShader.fragmentShader
            }));
        });
    }, []);

    useEffect(() => {
        // Update Sun position
        globeMaterial?.uniforms.sunPosition.value.set(...sunPosAt(dt));
    }, [dt, globeMaterial]);

    useEffect(() => {
        let animationFrameId: number;
        let startTime: number;
        let startDt: number;

        const animate = (currentTime: number) => {
            if (!startTime) {
                startTime = currentTime;
                startDt = dt;
            }

            const elapsed = currentTime - startTime;
            const duration = 1000; // 1 second animation duration
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing function
            const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const easedProgress = easeInOutCubic(progress);

            // Calculate new time with smooth interpolation
            const newDt = startDt + (desiredDt - startDt) * easedProgress;
            setDt(newDt);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        // Only start animation if there's a significant difference
        if (Math.abs(desiredDt - dt) > 1000) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            setDt(desiredDt);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [desiredDt]);

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        const newTime = newDate.getTime();
        // Update the actual dt state
        setDesiredDt(newTime);
    };

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Globe
                ref={globeRef}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
                globeMaterial={globeMaterial}
                width={window.innerWidth}
                height={window.innerHeight}
                onZoom={useCallback(({ lng, lat }: { lng: number; lat: number }) => 
                    globeMaterial?.uniforms.globeRotation.value.set(lng, lat), 
                    [globeMaterial])}
            />

            <div style={{ flexDirection: 'column', position: 'absolute', top: 0, left: 0, width: '300px', height: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '5px', zIndex: 1000 }}>
                <button onClick={() => setRotation(!rotation)}>
                    {rotation ? 'Stop' : 'Start'}
                </button>
                <input type="range" min="0" max="0.7" step={0.01} value={rotationSpeed} onChange={(e) => setRotationSpeed(Number(e.target.value))} />
                <input 
                    type="datetime-local" 
                    value={new Date(dt).toISOString().slice(0, 16)} 
                    onChange={handleTimeChange}
                    style={{ margin: '10px 0' }}
                />
            </div>
        </div>
    );
};

export default EarthSimulator;
