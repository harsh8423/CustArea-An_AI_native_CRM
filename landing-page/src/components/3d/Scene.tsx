'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SOCIAL_ICONS, ICON_POSITIONS } from './config';

const CUBE_SIZE = 3.8;

// Shared geometries
const planeGeometry = new THREE.PlaneGeometry(1, 1);
const robotGeometry = new THREE.PlaneGeometry(3, 3);
const sphereGeometry = new THREE.SphereGeometry(1, 12, 12);
const boxGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const wireframeGeometry = new THREE.BoxGeometry(CUBE_SIZE + 0.02, CUBE_SIZE + 0.02, CUBE_SIZE + 0.02);

// Robot on top of cube
function Robot() {
    const meshRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    const texture = useLoader(THREE.TextureLoader, '/robot.png');

    useFrame((state) => {
        if (!meshRef.current) return;
        meshRef.current.quaternion.copy(camera.quaternion);
        meshRef.current.position.y = CUBE_SIZE / 2 + 1 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
    });

    return (
        <mesh
            ref={meshRef}
            position={[0, CUBE_SIZE / 2 + 1.2, 0]}
            renderOrder={10}
            geometry={robotGeometry}
        >
            <meshBasicMaterial
                map={texture}
                transparent
                alphaTest={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// Icon with texture
function IconWithTexture({ iconPath, initialPosition, cubeLimit }: {
    iconPath: string;
    initialPosition: [number, number, number];
    cubeLimit: number
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    const texture = useLoader(THREE.TextureLoader, iconPath);

    const velocity = useRef(new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
    ));
    const pos = useRef(new THREE.Vector3(...initialPosition));

    useFrame(() => {
        if (!meshRef.current) return;

        pos.current.add(velocity.current);

        const limit = cubeLimit - 0.5;
        if (Math.abs(pos.current.x) > limit) { velocity.current.x *= -1; pos.current.x = Math.sign(pos.current.x) * limit; }
        if (Math.abs(pos.current.y) > limit) { velocity.current.y *= -1; pos.current.y = Math.sign(pos.current.y) * limit; }
        if (Math.abs(pos.current.z) > limit) { velocity.current.z *= -1; pos.current.z = Math.sign(pos.current.z) * limit; }

        meshRef.current.position.copy(pos.current);
        meshRef.current.quaternion.copy(camera.quaternion);
    });

    return (
        <mesh
            ref={meshRef}
            position={initialPosition}
            renderOrder={2}
            geometry={planeGeometry}
        >
            <meshBasicMaterial
                map={texture}
                transparent
                alphaTest={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// Glass cube
function GlassCube() {
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
        }
    });

    return (
        <group ref={meshRef} renderOrder={1}>
            <mesh renderOrder={0} geometry={boxGeometry}>
                <meshPhysicalMaterial
                    transmission={0.95}
                    thickness={0.5}
                    roughness={0.05}
                    color="#a8d4f0"
                    transparent
                    opacity={0.25}
                    ior={1.5}
                    clearcoat={0.3}
                    clearcoatRoughness={0.1}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            <mesh renderOrder={0} geometry={wireframeGeometry}>
                <meshBasicMaterial color="#a0a0a0" wireframe transparent opacity={0.5} depthWrite={false} />
            </mesh>
        </group>
    );
}

// Main scene
export function Scene() {
    return (
        <>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, -3, -3]} intensity={0.5} />

            <GlassCube />
            <Robot />

            {SOCIAL_ICONS.map((icon, i) => (
                <IconWithTexture
                    key={icon.id}
                    iconPath={icon.iconPath}
                    initialPosition={ICON_POSITIONS[i]}
                    cubeLimit={CUBE_SIZE / 2}
                />
            ))}

            <OrbitControls
                enablePan={false}
                enableZoom={false}
                autoRotate
                autoRotateSpeed={0.3}
            />
        </>
    );
}
