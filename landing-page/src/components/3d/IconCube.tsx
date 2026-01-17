'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import type { SocialIcon } from './config';

interface IconCubeProps {
    position: [number, number, number];
    icon: SocialIcon;
    index: number;
}

// Simple 3D Icon cube with colored faces and white circles
export function IconCube({ position, icon, index }: IconCubeProps) {
    const [ref, api] = useSphere(() => ({
        mass: 0.4,
        position,
        args: [0.55],
        material: { friction: 0.02, restitution: 0.95 },
        linearDamping: 0.02,
        angularDamping: 0.08,
    }));

    // Initial velocity
    useEffect(() => {
        const timer = setTimeout(() => {
            api.velocity.set(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
            );
            api.angularVelocity.set(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
        }, index * 150 + 300);
        return () => clearTimeout(timer);
    }, [api, index]);

    // Occasional impulse
    useFrame(() => {
        if (Math.random() < 0.002) {
            api.applyImpulse(
                [(Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8],
                [0, 0, 0]
            );
        }
    });

    return (
        <group ref={ref as React.RefObject<THREE.Group>}>
            {/* Main rounded cube body with brand color */}
            <RoundedBox args={[1, 1, 1]} radius={0.18} smoothness={4}>
                <meshPhysicalMaterial
                    color={icon.color}
                    metalness={0.05}
                    roughness={0.3}
                    clearcoat={0.4}
                    clearcoatRoughness={0.4}
                />
            </RoundedBox>

            {/* White circle on front face */}
            <mesh position={[0, 0, 0.51]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* White circle on back face */}
            <mesh position={[0, 0, -0.51]} rotation={[0, Math.PI, 0]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* White circle on right face */}
            <mesh position={[0.51, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* White circle on left face */}
            <mesh position={[-0.51, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* White circle on top face */}
            <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* White circle on bottom face */}
            <mesh position={[0, -0.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
        </group>
    );
}
