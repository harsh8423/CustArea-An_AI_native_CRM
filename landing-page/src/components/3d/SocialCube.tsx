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
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile viewport and only render 3D on client side
    useEffect(() => {
        setMounted(true);

        // Check if viewport is mobile sized
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024); // lg breakpoint
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!mounted) {
        return (
            <div className="w-full h-[280px] sm:h-[350px] lg:h-[500px] flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    // Responsive camera settings
    const cameraSettings = isMobile ? {
        position: [8, 6, 8] as [number, number, number], // Further back on mobile
        fov: 50, // Wider FOV on mobile to fit cube better
    } : {
        position: [7, 5, 7] as [number, number, number],
        fov: 45,
    };

    return (
        <div className="w-full h-[280px] sm:h-[350px] lg:h-[500px] relative">
            <Suspense fallback={<Loader />}>
                <Canvas
                    camera={{
                        ...cameraSettings,
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
