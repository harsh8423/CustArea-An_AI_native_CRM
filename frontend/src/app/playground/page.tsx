'use client';

import { usePipeline, PipelineState } from '@/hooks/usePipeline';

export default function PlaygroundPage() {
    const {
        state,
        transcript,
        reply,
        error,
        videoRef,
        startSession,
        stopSession,
    } = usePipeline();

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 pt-24 pb-12">
            <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-8">

                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-semibold">
                        Interactive Avatar Agent
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${state === PipelineState.Idle ? 'bg-slate-500' :
                                state === PipelineState.Listening ? 'bg-green-500 animate-pulse' :
                                    state === PipelineState.Thinking ? 'bg-blue-500 animate-pulse' :
                                        state === PipelineState.Speaking ? 'bg-purple-500' :
                                            'bg-red-500'
                            }`} />
                        <span className="text-sm font-medium uppercase tracking-wider text-slate-400">
                            {state}
                        </span>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-lg text-sm">
                        Error: {error}
                    </div>
                )}

                {/* Video Container */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-800 shadow-2xl">
                    {/* Video Element - Managed by LiveKit via Service */}
                    <div ref={videoRef} className="absolute inset-0 w-full h-full" />

                    {/* Overlay for Idle/Connecting State */}
                    {state === PipelineState.Idle && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                            <p className="text-slate-400">Ready to connect</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex gap-4">
                    <button
                        onClick={startSession}
                        disabled={state !== PipelineState.Idle && state !== PipelineState.Error}
                        className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
                    >
                        Start Conversation
                    </button>
                    <button
                        onClick={stopSession}
                        disabled={state === PipelineState.Idle}
                        className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-all"
                    >
                        End Session
                    </button>
                </div>

                {/* Transcript / Conversation Log */}
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 h-48 overflow-auto">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">You</h3>
                        <p className="text-slate-200 whitespace-pre-wrap">{transcript || '...'}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 h-48 overflow-auto">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Agent</h3>
                        <p className="text-indigo-200 whitespace-pre-wrap">{reply || '...'}</p>
                    </div>
                </div>

            </div>
        </main>
    );
}
