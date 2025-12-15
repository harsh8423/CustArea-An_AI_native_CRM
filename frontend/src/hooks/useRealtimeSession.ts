import { useState, useRef, useEffect, useCallback } from 'react';

export type WorkflowType = 'legacy' | 'realtime';

export function useRealtimeSession() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState<string[]>([]);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [llmResponse, setLlmResponse] = useState('');
    const [status, setStatus] = useState('Ready');
    const [workflow, setWorkflow] = useState<WorkflowType>('legacy');

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Audio Playback Queue and State
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef(false);
    const playbackContextRef = useRef<AudioContext | null>(null);
    // Track all scheduled sources to stop them on interrupt
    const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
    // Track the next start time for smooth scheduling
    const nextStartTimeRef = useRef<number>(0);

    useEffect(() => {
        // Initialize playback context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        playbackContextRef.current = new AudioContextClass();

        return () => {
            stopRecording();
            // Stop any playing audio on unmount
            scheduledSourcesRef.current.forEach(source => {
                try { source.stop(); } catch (e) { }
            });
        }
    }, []);

    const playNextAudio = useCallback(async () => {
        if (audioQueueRef.current.length === 0 || !playbackContextRef.current) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const audioData = audioQueueRef.current.shift();

        try {
            if (audioData && playbackContextRef.current) {
                const ctx = playbackContextRef.current;
                // OpenAI Realtime returns raw PCM16 at 24kHz
                const int16Array = new Int16Array(audioData);
                const float32Array = new Float32Array(int16Array.length);

                for (let i = 0; i < int16Array.length; i++) {
                    float32Array[i] = int16Array[i] / 32768;
                }

                const sampleRate = 24000;
                const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
                audioBuffer.getChannelData(0).set(float32Array);

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);

                // Schedule playback
                const currentTime = ctx.currentTime;
                // If nextStartTime is in the past, reset it to now (plus a tiny buffer)
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime + 0.05;
                }

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;

                // Add to tracked sources
                scheduledSourcesRef.current.push(source);

                // Remove from tracked sources when done
                source.onended = () => {
                    scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
                };

                // We don't wait for onended to play the next chunk, we just schedule it.
                // However, we keep the loop running.
                playNextAudio();
            }
        } catch (err) {
            console.error('Error playing audio:', err);
            isPlayingRef.current = false;
            playNextAudio();
        }
    }, []);

    const floatTo16BitPCM = (float32Array: Float32Array) => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    const downsampleBuffer = (buffer: Float32Array, sampleRate: number, outSampleRate = 16000) => {
        if (outSampleRate === sampleRate) return buffer;
        const ratio = sampleRate / outSampleRate;
        const newLength = Math.round(buffer.length / ratio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            result[offsetResult++] = buffer[Math.floor(offsetBuffer)];
            offsetBuffer += ratio;
        }
        return result;
    };

    // Helper to convert base64 to ArrayBuffer
    const base64ToArrayBuffer = (base64: string) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    // Helper to convert ArrayBuffer to base64
    const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };

    const startAudioCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;

            const bufferSize = 4096;
            const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
            processorRef.current = processor;

            // Target Sample Rate: 16000 for Legacy, 24000 for Realtime
            const targetSampleRate = workflow === 'legacy' ? 16000 : 24000;

            processor.onaudioprocess = (e) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

                const float32Data = e.inputBuffer.getChannelData(0);
                const downsampled = downsampleBuffer(float32Data, audioContext.sampleRate, targetSampleRate);
                const pcm16Buffer = floatTo16BitPCM(downsampled);

                if (workflow === 'legacy') {
                    wsRef.current.send(pcm16Buffer);
                } else {
                    // Realtime expects base64 encoded JSON events
                    const base64Audio = arrayBufferToBase64(pcm16Buffer);
                    wsRef.current.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64Audio
                    }));
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setStatus('Microphone Error');
            stopRecording();
        }
    };

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        setStatus('Stopped');

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'end' }));
                wsRef.current.close();
            }
            wsRef.current = null;
        }
    }, []);

    const startRecording = async () => {
        try {
            setStatus('Connecting...');
            const url = workflow === 'legacy'
                ? 'ws://localhost:8000/client-audio'
                : 'ws://localhost:8000/openai-realtime';

            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            ws.onopen = async () => {
                setStatus('Connected. Listening...');
                setIsRecording(true);
                setLlmResponse('');

                // Note: Realtime session update is now handled by the backend on connection

                await startAudioCapture();
            };

            ws.onmessage = (evt) => {
                if (workflow === 'legacy') {
                    // Legacy Handling
                    if (typeof evt.data === 'string') {
                        const msg = JSON.parse(evt.data);
                        if (msg.type === 'transcript') {
                            setTranscripts((prev) => [...prev, msg.text]);
                            setInterimTranscript('');
                            setLlmResponse('');
                        } else if (msg.type === 'interim') {
                            setInterimTranscript(msg.text);
                        } else if (msg.type === 'llm-chunk') {
                            setLlmResponse((prev) => prev + msg.content);
                        } else if (msg.type === 'interrupt') {
                            audioQueueRef.current = [];
                            isPlayingRef.current = false;
                            scheduledSourcesRef.current.forEach(source => {
                                try { source.stop(); } catch (e) { }
                            });
                            scheduledSourcesRef.current = [];
                        } else if (msg.type === 'error') {
                            console.error('Server error:', msg.detail);
                            setStatus('Error: ' + msg.detail);
                            stopRecording();
                        }
                    } else if (evt.data instanceof ArrayBuffer) {
                        audioQueueRef.current.push(evt.data);
                        playNextAudio();
                    }
                } else {
                    // Realtime Handling
                    try {
                        const msg = JSON.parse(evt.data);
                        if (msg.type === 'response.audio.delta') {
                            const audioData = base64ToArrayBuffer(msg.delta);
                            audioQueueRef.current.push(audioData);
                            playNextAudio();
                        } else if (msg.type === 'response.audio_transcript.delta') {
                            setLlmResponse((prev) => prev + msg.delta);
                        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                            setTranscripts((prev) => [...prev, msg.transcript]);
                        } else if (msg.type === 'interrupt') {
                            console.log('Interruption detected, stopping playback');
                            audioQueueRef.current = [];
                            isPlayingRef.current = false;
                            nextStartTimeRef.current = 0; // Reset scheduling

                            // Stop all scheduled sources
                            scheduledSourcesRef.current.forEach(source => {
                                try { source.stop(); } catch (e) { }
                            });
                            scheduledSourcesRef.current = [];

                        } else if (msg.type === 'error') {
                            console.error('Realtime Error:', msg);
                        }
                    } catch (e) {
                        console.error('Error parsing realtime message:', e);
                    }
                }
            };

            ws.onclose = () => {
                if (isRecording) stopRecording();
                setStatus('Disconnected');
            };

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                setStatus('Connection Error');
                stopRecording();
            };

        } catch (err) {
            console.error('Failed to start recording:', err);
            setStatus('Failed to start');
        }
    };

    return {
        isRecording,
        transcripts,
        interimTranscript,
        llmResponse,
        status,
        workflow,
        setWorkflow,
        startRecording,
        stopRecording
    };
}
