'use client';

import { useBox } from '@react-three/cannon';
import * as THREE from 'three';

interface WallProps {
    position: [number, number, number];
    args: [number, number, number];
}

// Invisible physics wall
function Wall({ position, args }: WallProps) {
    const [ref] = useBox(() => ({
        type: 'Static',
        position,
        args,
        material: { friction: 0.02, restitution: 0.98 },
    }));

    return <mesh ref={ref as React.RefObject<THREE.Mesh>} visible={false} />;
}

interface CubeBoundariesProps {
    size?: number;
}

// Physics boundaries for the glass cube
export function CubeBoundaries({ size = 4.5 }: CubeBoundariesProps) {
    const wallThickness = 0.2;
    const halfSize = size / 2;

    const walls: WallProps[] = [
        // Top
        { position: [0, halfSize + wallThickness / 2, 0], args: [size + 1, wallThickness, size + 1] },
        // Bottom
        { position: [0, -halfSize - wallThickness / 2, 0], args: [size + 1, wallThickness, size + 1] },
        // Right
        { position: [halfSize + wallThickness / 2, 0, 0], args: [wallThickness, size + 1, size + 1] },
        // Left
        { position: [-halfSize - wallThickness / 2, 0, 0], args: [wallThickness, size + 1, size + 1] },
        // Front
        { position: [0, 0, halfSize + wallThickness / 2], args: [size + 1, size + 1, wallThickness] },
        // Back
        { position: [0, 0, -halfSize - wallThickness / 2], args: [size + 1, size + 1, wallThickness] },
    ];

    return (
        <>
            {walls.map((wall, i) => (
                <Wall key={i} {...wall} />
            ))}
        </>
    );
}
