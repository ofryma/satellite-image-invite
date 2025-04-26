import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Globe from "react-globe.gl";
import { GlobeMethods } from "react-globe.gl";
import { TextureLoader, ShaderMaterial, Vector2 } from 'three';
import * as satellite from 'satellite.js';

import { dayNightShader } from './dayNightShader';
import { sunPosAt} from './utils';

// Define types for satellite data
interface SatelliteData {
    satrec: any;
    name: string;
    lat?: number;
    lng?: number;
    alt?: number;
    futurePoint?: boolean;
    color?: string;
}

const VELOCITY = 0.1; // minutes per frame
const EARTH_RADIUS_KM = 6371; // km
const TIME_STEP = 3 * 1000; // per frame

const EarthSimulator = () => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);

    // Animation
    const [rotation, setRotation] = useState<boolean>(false);
    const [rotationSpeed, setRotationSpeed] = useState<number>(0.2);
    const [globeMaterial, setGlobeMaterial] = useState<ShaderMaterial | undefined>();
    const [particleSize, setParticleSize] = useState<number>(1);
    const [isRealTime, setIsRealTime] = useState<boolean>(false);

    // Reference time
    const [dt, setDt] = useState<number>(+new Date());
    const [desiredDt, setDesiredDt] = useState<number>(+new Date());

    // Satellite data
    const [satData, setSatData] = useState<SatelliteData[]>([]);
    const [globeRadius, setGlobeRadius] = useState<number>(0);
    const [time, setTime] = useState(new Date());
    const [filteredSatellites, setFilteredSatellites] = useState<string[]>([]);
    const [selectedSatellites, setSelectedSatellites] = useState<Set<string>>(new Set());

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
            if (isRealTime) {
                // Update to current time when in real-time mode
                setDt(+new Date());
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

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

        // Only start animation if there's a significant difference or in real-time mode
        if (isRealTime || Math.abs(desiredDt - dt) > 1000) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            setDt(desiredDt);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [desiredDt, isRealTime]);


    useEffect(() => {
        // load satellite data
        fetch('//cdn.jsdelivr.net/npm/globe.gl/example/datasets/space-track-leo.txt').then(r => r.text()).then(rawData => {
            const tleData = rawData.replace(/\r/g, '')
                .split(/\n(?=[^12])/)
                .filter(d => d)
                .map(tle => tle.split('\n'));
                
            const satData = tleData.map(([name, ...tle]) => ({
                satrec: satellite.twoline2satrec(tle[0], tle[1]),
                name: name.trim().replace(/^0 /, ''),
                color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
            }))
                // exclude those that can't be propagated
                .filter(d => !!satellite.propagate(d.satrec, new Date())?.position);

            setSatData(satData);
        });
    }, []);

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        const newTime = newDate.getTime();
        // Update the actual dt state
        setDesiredDt(newTime);
    };

    const handleSatelliteSelect = (name: string) => {
        setSelectedSatellites(prev => {
            const newSet = new Set(prev);
            if (newSet.has(name)) {
                newSet.delete(name);
            } else {
                newSet.add(name);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        setSelectedSatellites(new Set(filteredSatellites));
    };

    const handleDeselectAll = () => {
        setSelectedSatellites(new Set());
    };

    const particlesData = useMemo(() => {
        if (!satData.length) return [];

        // Update satellite positions
        const gmst = satellite.gstime(new Date(dt));
        return [
            satData
                .filter((d: SatelliteData) => selectedSatellites.has(d.name))
                .map((d: SatelliteData) => {
                    const eci = satellite.propagate(d.satrec, new Date(dt));
                    if (eci?.position) {
                        const gdPos = satellite.eciToGeodetic(eci.position, gmst);
                        const lat = satellite.radiansToDegrees(gdPos.latitude);
                        const lng = satellite.radiansToDegrees(gdPos.longitude);
                        const alt = gdPos.height / EARTH_RADIUS_KM;
                        const color = d.color;
                        return { ...d, lat, lng, alt, color };
                    }
                    return d;
                }).filter((d: SatelliteData) => !isNaN(d.lat!) && !isNaN(d.lng!) && !isNaN(d.alt!))
        ];
    }, [satData, dt, selectedSatellites]);

    useEffect(() => {
        if (globeRef.current) {
            setGlobeRadius(globeRef.current.getGlobeRadius());
            globeRef.current.pointOfView({ altitude: 3.5 });
        }
    }, []);

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
                particlesData={particlesData}
                particleLabel="name"
                particleLat="lat"
                particleLng="lng"
                particleAltitude="alt"
                particlesColor={useCallback((d: any) => (d as SatelliteData).color || 'palegreen', [])}
                particlesSize={particleSize}
            />

            <div style={{flexDirection: 'column', position: 'absolute', top: 0, left: 0, width: '300px', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '5px', zIndex: 1000 }}>
                <button onClick={() => setRotation(!rotation)}>
                    {rotation ? 'Stop' : 'Start'}
                </button>
                <button 
                    onClick={() => setIsRealTime(!isRealTime)}
                    style={{
                        backgroundColor: isRealTime ? '#4CAF50' : '#f44336',
                        color: 'white',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        margin: '10px 0'
                    }}
                >
                    {isRealTime ? 'Real-time Mode: ON' : 'Real-time Mode: OFF'}
                </button>
                <input type="range" min="0" max="0.7" step={0.01} value={rotationSpeed} onChange={(e) => setRotationSpeed(Number(e.target.value))} />
                <input
                    type="datetime-local"
                    value={new Date(dt).toISOString().slice(0, 16)}
                    onChange={handleTimeChange}
                    style={{ margin: '10px 0' }}
                    disabled={isRealTime}
                />
                <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
                    <label style={{ marginRight: '10px' }}>Satellite Size:</label>
                    <input
                        type="range"
                        min="0.5"
                        max="5"
                        step="0.1"
                        value={particleSize}
                        onChange={(e) => setParticleSize(Number(e.target.value))}
                        style={{ width: '100px' }}
                    />
                </div>
                <div style={{ position: 'relative', width: '200px' }}>
                    <input
                        type="text"
                        placeholder="Search satellites..."
                        style={{
                            width: '100%',
                            padding: '5px',
                            margin: '10px 0',
                            borderRadius: '4px',
                            border: '1px solid #ccc'
                        }}
                        onChange={(e) => {
                            const searchTerm = e.target.value.toLowerCase();
                            const filteredSatellites = Array.from(new Set(satData.map(sat => sat.name)))
                                .filter(name => name.toLowerCase().includes(searchTerm));
                            setFilteredSatellites(filteredSatellites);
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        zIndex: 1000
                    }}>
                        <div style={{
                            padding: '5px',
                            borderBottom: '1px solid #ccc',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}>
                            <button
                                onClick={handleSelectAll}
                                style={{
                                    padding: '2px 5px',
                                    margin: '0 2px',
                                    cursor: 'pointer'
                                }}
                            >
                                Select All
                            </button>
                            <button
                                onClick={handleDeselectAll}
                                style={{
                                    padding: '2px 5px',
                                    margin: '0 2px',
                                    cursor: 'pointer'
                                }}
                            >
                                Deselect All
                            </button>
                        </div>
                        {filteredSatellites.map((name, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '5px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedSatellites.has(name) ? '#e0e0e0' : 'white',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = selectedSatellites.has(name) ? '#d0d0d0' : '#f0f0f0';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = selectedSatellites.has(name) ? '#e0e0e0' : 'white';
                                }}
                                onClick={() => handleSatelliteSelect(name)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedSatellites.has(name)}
                                    onChange={() => {}}
                                    style={{ marginRight: '5px' }}
                                />
                                {name}
                            </div>
                        ))}
                    </div>
                    {selectedSatellites.size > 0 && (
                        <div style={{
                            marginTop: '5px',
                            padding: '5px',
                            backgroundColor: '#f8f8f8',
                            borderRadius: '4px',
                            fontSize: '0.9em'
                        }}>
                            Selected: {selectedSatellites.size} satellite{selectedSatellites.size !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EarthSimulator;
