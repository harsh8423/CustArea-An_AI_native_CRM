import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getTokenOrRefresh } from '@/lib/speechToken';
import { ISTTService } from '../types';

type STTEvent = 'speech_recognized' | 'speech_hypothesizing';
type STTListener = (text: string) => void;

export class AzureSTTService implements ISTTService {
    private recognizer: SpeechSDK.SpeechRecognizer | null = null;
    private listeners: Map<STTEvent, STTListener[]> = new Map();

    constructor() {
        this.listeners.set('speech_recognized', []);
        this.listeners.set('speech_hypothesizing', []);
    }

    on(event: STTEvent, listener: STTListener): void {
        const current = this.listeners.get(event) || [];
        current.push(listener);
        this.listeners.set(event, current);
    }

    private emit(event: STTEvent, text: string) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(l => l(text));
        }
    }

    async start(): Promise<void> {
        if (this.recognizer) return;

        const tokenObj = await getTokenOrRefresh();
        if (!tokenObj.authToken || !tokenObj.region) {
            throw new Error(tokenObj.error || 'Failed to get speech token');
        }

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
            tokenObj.authToken,
            tokenObj.region
        );
        speechConfig.speechRecognitionLanguage = 'en-US';

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        this.recognizer.recognizing = (s, e) => {
            if (e.result.text) {
                this.emit('speech_hypothesizing', e.result.text);
            }
        };

        this.recognizer.recognized = (s, e) => {
            if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
                this.emit('speech_recognized', e.result.text);
            }
        };

        this.recognizer.canceled = (s, e) => {
            console.warn('[STT] Canceled:', e.reason, e.errorDetails);
            this.stop();
        };

        this.recognizer.sessionStopped = (s, e) => {
            console.log('[STT] Session stopped');
            this.stop();
        };

        return new Promise((resolve, reject) => {
            this.recognizer!.startContinuousRecognitionAsync(
                () => {
                    console.log('[STT] Started');
                    resolve();
                },
                (err) => {
                    console.error('[STT] Failed to start:', err);
                    reject(err);
                }
            );
        });
    }

    async stop(): Promise<void> {
        if (!this.recognizer) return;

        return new Promise((resolve, reject) => {
            this.recognizer!.stopContinuousRecognitionAsync(
                () => {
                    console.log('[STT] Stopped');
                    this.close();
                    resolve();
                },
                (err) => {
                    console.error('[STT] Failed to stop:', err);
                    this.close(); // Force close
                    reject(err);
                }
            );
        });
    }

    close(): void {
        if (this.recognizer) {
            try {
                this.recognizer.close();
            } catch (e) {
                console.warn('[STT] Error closing recognizer:', e);
            }
            this.recognizer = null;
        }
    }
}
