import { useState, useEffect, useRef, useCallback } from 'react';
import { ServiceFactory, defaultConfig } from '../services/factory';

export enum PipelineState {
    Idle = 'idle',
    Listening = 'listening',
    Thinking = 'thinking',
    Speaking = 'speaking',
    Error = 'error',
}

export function usePipeline() {
    const [state, setState] = useState<PipelineState>(PipelineState.Idle);
    const [transcript, setTranscript] = useState('');
    const [reply, setReply] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Services (Instantiated via Factory)
    const stt = useRef(ServiceFactory.createSTT());
    const llm = useRef(ServiceFactory.createLLM());
    const tts = useRef(ServiceFactory.createTTS());
    const avatar = useRef(ServiceFactory.createAvatar(defaultConfig));

    // Video Ref
    const videoRef = useRef<HTMLDivElement>(null);

    // Initialize Avatar Video
    useEffect(() => {
        if (videoRef.current) {
            avatar.current.attachVideo(videoRef.current);
        }
    }, []);

    const handleSpeechRecognized = useCallback(async (text: string) => {
        console.log('[Pipeline] User said:', text);
        setTranscript(text);
        setState(PipelineState.Thinking);
        setReply(''); // Clear previous reply

        try {
            // 1. Generate LLM Stream
            const stream = llm.current.generateStream(text);

            // 2. TTS Stream (Consumes LLM Stream)
            // We need to accumulate text for display while streaming audio
            const textStreamForTTS = async function* () {
                for await (const chunk of stream) {
                    setReply(prev => prev + chunk);
                    yield chunk;
                }
            };

            const audioStream = tts.current.speakStream(textStreamForTTS());

            // 3. Speak with Avatar (Consumes Audio Stream)
            setState(PipelineState.Speaking);
            for await (const audioChunk of audioStream) {
                await avatar.current.speak(audioChunk);
            }

            // Wait for avatar to finish speaking (optional, handled by events)

        } catch (err: any) {
            console.error('[Pipeline] Error processing speech:', err);
            setError(err.message);
            setState(PipelineState.Error);
        } finally {
            // Ideally wait for avatar 'speaking_ended' event
            // For now, we can reset to listening if continuous, or idle
            // Let's rely on avatar events to switch back to listening/idle
        }
    }, []);

    // Setup Event Listeners
    useEffect(() => {
        const sttService = stt.current;
        const avatarService = avatar.current;

        sttService.on('speech_recognized', handleSpeechRecognized);

        sttService.on('speech_hypothesizing', (text) => {
            setTranscript(text);
        });

        avatarService.on('speaking_ended', () => {
            console.log('[Pipeline] Avatar finished speaking');
            // Resume listening or go to idle
            // For continuous conversation, we might want to start listening again
            // But let's keep it manual for now or simple state switch
            setState(PipelineState.Idle);
        });

        avatarService.on('disconnected', () => {
            setState(PipelineState.Idle);
        });

        return () => {
            sttService.close();
            tts.current.close();
            avatarService.disconnect();
        };
    }, [handleSpeechRecognized]);

    const startSession = async () => {
        try {
            setError(null);
            setState(PipelineState.Idle); // Connecting...

            console.log('[Pipeline] Connecting avatar...');
            await avatar.current.connect();

            console.log('[Pipeline] Starting STT...');
            await stt.current.start();

            setState(PipelineState.Listening);
        } catch (err: any) {
            console.error('[Pipeline] Failed to start session:', err);
            setError(err.message);
            setState(PipelineState.Error);
        }
    };

    const stopSession = async () => {
        try {
            await stt.current.stop();
            await avatar.current.disconnect();
            setState(PipelineState.Idle);
        } catch (err: any) {
            console.error('[Pipeline] Failed to stop session:', err);
        }
    };

    return {
        state,
        transcript,
        reply,
        error,
        videoRef,
        startSession,
        stopSession,
    };
}
