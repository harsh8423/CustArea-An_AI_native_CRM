'use client';

import { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';

// Loading spinner component
function Loader() {
    return (
        <div className="cube-loader">
            <div className="cube-loader-spinner" />
        </div>
    );
}

// Main exported 3D Social Cube component
export default function SocialCube() {
    const [mounted, setMounted] = useState(false);

    // Only render 3D on client side
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div style={{
                width: '100%',
                height: '500px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Loader />
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            height: '500px',
            position: 'relative'
        }}>
            <Suspense fallback={<Loader />}>
                <Canvas
                    camera={{
                        position: [7, 5, 7],
                        fov: 45,
                        near: 0.1,
                        far: 1000
                    }}
                    dpr={[1, 2]}
                    gl={{
                        antialias: true,
                        alpha: true,
                    }}
                    style={{
                        background: 'transparent',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                    }}
                >
                    <Scene />
                </Canvas>
            </Suspense>


        </div>
    );
}
