'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlassCubeProps {
    size?: number;
}

// Bubble particle component
function Bubble({ position, scale }: { position: [number, number, number]; scale: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const speed = useMemo(() => 0.2 + Math.random() * 0.3, []);
    const offset = useMemo(() => Math.random() * Math.PI * 2, []);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed + offset) * 0.15;
            meshRef.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * speed * 0.7 + offset) * 0.08;
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <sphereGeometry args={[scale, 16, 16]} />
            <meshPhysicalMaterial
                color="#e8e8e8"
                transparent
                opacity={0.5}
                roughness={0}
                metalness={0}
                transmission={0.7}
            />
        </mesh>
    );
}

// Generate random bubble positions
function generateBubbles(count: number, cubeSize: number): Array<{ position: [number, number, number]; scale: number }> {
    const bubbles = [];
    const halfSize = cubeSize / 2 - 0.3;

    for (let i = 0; i < count; i++) {
        bubbles.push({
            position: [
                (Math.random() - 0.5) * halfSize * 2,
                (Math.random() - 0.5) * halfSize * 2,
                (Math.random() - 0.5) * halfSize * 2,
            ] as [number, number, number],
            scale: 0.03 + Math.random() * 0.06,
        });
    }
    return bubbles;
}

// Transparent glass cube with bubbles
export function GlassCube({ size = 4.5 }: GlassCubeProps) {
    const meshRef = useRef<THREE.Group>(null);
    const bubbles = useMemo(() => generateBubbles(20, size), [size]);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.015;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.06) * 0.01;
        }
    });

    return (
        <group ref={meshRef}>
            {/* Main glass cube - slightly grey transparent */}
            <mesh>
                <boxGeometry args={[size, size, size]} />
                <meshPhysicalMaterial
                    transmission={1}
                    thickness={0.4}
                    roughness={0}
                    transparent
                    opacity={0.2}
                    color="#e5e7eb"
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Edge wireframe */}
            <mesh>
                <boxGeometry args={[size + 0.02, size + 0.02, size + 0.02]} />
                <meshBasicMaterial
                    color="#9ca3af"
                    transparent
                    opacity={0.4}
                    wireframe
                />
            </mesh>

            {/* Internal bubbles */}
            {bubbles.map((bubble, i) => (
                <Bubble key={i} position={bubble.position} scale={bubble.scale} />
            ))}
        </group>
    );
}
