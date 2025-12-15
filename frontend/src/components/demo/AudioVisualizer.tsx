import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
    isRecording: boolean;
}

export function AudioVisualizer({ isRecording }: AudioVisualizerProps) {
    return (
        <div className="flex items-center justify-center gap-1 h-8">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "w-1 bg-primary rounded-full transition-all duration-300",
                        isRecording ? "animate-pulse-slow" : "h-1 opacity-20"
                    )}
                    style={{
                        height: isRecording ? `${Math.random() * 24 + 8}px` : "4px",
                        animationDelay: `${i * 0.1}s`
                    }}
                />
            ))}
        </div>
    );
}
