'use client';

import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { AudioVisualizer } from '@/components/demo/AudioVisualizer';
import { ChatMessage } from '@/components/demo/ChatMessage';
import { Mic, Square, Radio, Activity } from 'lucide-react';

export default function DemoPage() {
    const {
        isRecording,
        transcripts,
        interimTranscript,
        llmResponse,
        status,
        workflow,
        setWorkflow,
        startRecording,
        stopRecording
    } = useRealtimeSession();

    return (
        <main className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
            <Navbar />

            <div className="flex-grow container mx-auto px-4 py-12 flex flex-col items-center justify-center">

                {/* Header & Controls */}
                <div className="w-full max-w-5xl mb-12 flex flex-col items-center text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                        Interactive Demo
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                        Experience the power of our AI voice capabilities. Switch between legacy and realtime modes to see the difference.
                    </p>

                    <GlassCard className="p-1.5 inline-flex items-center gap-1 rounded-full bg-secondary/50 backdrop-blur-xl border-white/5">
                        <Button
                            variant={workflow === 'legacy' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => !isRecording && setWorkflow('legacy')}
                            className={`rounded-full px-6 transition-all duration-300 ${workflow === 'legacy' ? 'bg-white/10 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                        >
                            Legacy Pipeline
                        </Button>
                        <Button
                            variant={workflow === 'realtime' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => !isRecording && setWorkflow('realtime')}
                            className={`rounded-full px-6 transition-all duration-300 ${workflow === 'realtime' ? 'bg-primary/20 text-primary shadow-lg border border-primary/20' : 'text-muted-foreground hover:text-white'}`}
                        >
                            OpenAI Realtime
                        </Button>
                    </GlassCard>
                </div>

                {/* Main Interaction Area */}
                <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 h-[600px]">

                    {/* User Speech Section */}
                    <GlassCard gradient className="flex flex-col h-full border-white/10 bg-black/20">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-muted-foreground'}`}>
                                    <Mic className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">Your Speech</h2>
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <span className={isRecording ? "text-green-400" : "text-muted-foreground"}>
                                            {status}
                                        </span>
                                        {isRecording && <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>}
                                    </div>
                                </div>
                            </div>

                            {isRecording ? (
                                <Button
                                    onClick={stopRecording}
                                    variant="destructive"
                                    className="rounded-full px-6 shadow-red-500/20 shadow-lg hover:shadow-red-500/40 transition-all"
                                >
                                    <Square className="w-4 h-4 mr-2 fill-current" /> Stop
                                </Button>
                            ) : (
                                <Button
                                    onClick={startRecording}
                                    className="rounded-full px-6 bg-primary hover:bg-primary/90 shadow-primary/20 shadow-lg hover:shadow-primary/40 transition-all"
                                >
                                    <Radio className="w-4 h-4 mr-2" /> Start Recording
                                </Button>
                            )}
                        </div>

                        <div className="flex-grow p-6 overflow-y-auto space-y-4 custom-scrollbar">
                            {transcripts.length === 0 && !interimTranscript ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-4">
                                    <Mic className="w-12 h-12 opacity-20" />
                                    <p>Tap start and speak into your microphone...</p>
                                </div>
                            ) : (
                                <>
                                    {transcripts.map((text, i) => (
                                        <ChatMessage key={i} role="user" content={text} />
                                    ))}
                                    {interimTranscript && (
                                        <ChatMessage role="user" content={interimTranscript} isInterim />
                                    )}
                                </>
                            )}
                        </div>

                        {isRecording && (
                            <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm flex justify-center">
                                <AudioVisualizer isRecording={isRecording} />
                            </div>
                        )}
                    </GlassCard>

                    {/* AI Response Section */}
                    <GlassCard className="flex flex-col h-full border-white/10 bg-black/20">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">AI Response</h2>
                                    <p className="text-xs text-muted-foreground">Real-time generation</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                            {!llmResponse ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-4">
                                    <Activity className="w-12 h-12 opacity-20" />
                                    <p>AI response will appear here...</p>
                                </div>
                            ) : (
                                <ChatMessage role="ai" content={llmResponse} />
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>
            <Footer />
        </main>
    );
}
