import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getTokenOrRefresh } from '@/lib/speechToken';
import { ITTSService, AudioChunk } from '../types';
import { convertAzureAudioToPCM } from '../utils';

export class AzureTTSService implements ITTSService {
    private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
    private tokenExpiry: number = 0;

    private async initSynthesizer(muteLocal: boolean = true): Promise<SpeechSDK.SpeechSynthesizer> {
        if (this.synthesizer && Date.now() < this.tokenExpiry) {
            return this.synthesizer;
        }

        if (this.synthesizer) {
            this.synthesizer.close();
            this.synthesizer = null;
        }

        const tokenObj = await getTokenOrRefresh();
        if (!tokenObj.authToken || !tokenObj.region) {
            throw new Error(tokenObj.error || 'Failed to get speech token');
        }

        this.tokenExpiry = Date.now() + 4 * 60 * 1000; // Refresh every 4 mins

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
            tokenObj.authToken,
            tokenObj.region
        );
        speechConfig.speechSynthesisVoiceName = 'en-US-AvaNeural';
        speechConfig.speechSynthesisLanguage = 'en-US';
        speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

        // Mute local playback if requested (default for avatar flow)
        const audioConfig = muteLocal ? null : SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();

        this.synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig!);
        return this.synthesizer;
    }

    async speak(text: string): Promise<AudioChunk> {
        const synthesizer = await this.initSynthesizer(false); // Enable local playback for simple TTS

        return new Promise((resolve, reject) => {
            synthesizer.speakTextAsync(
                text,
                async (result) => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        try {
                            const pcm = await convertAzureAudioToPCM(result);
                            resolve(pcm);
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(new Error('TTS Canceled: ' + result.errorDetails));
                    }
                },
                (err) => reject(err)
            );
        });
    }

    async *speakStream(textStream: AsyncGenerator<string>): AsyncGenerator<AudioChunk, void, unknown> {
        try {
            for await (const textChunk of textStream) {
                const synthesizer = await this.initSynthesizer(true); // Mute local for stream (avatar handles it)

                // Split chunk further if needed, or just speak it
                // Simple splitting by sentence for better flow if the chunk is large
                // But assuming the LLM stream gives reasonable chunks

                const audioChunk = await new Promise<AudioChunk>((resolve, reject) => {
                    synthesizer.speakTextAsync(
                        textChunk,
                        async (result) => {
                            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                                try {
                                    const pcm = await convertAzureAudioToPCM(result);
                                    resolve(pcm);
                                } catch (e) {
                                    reject(e);
                                }
                            } else {
                                reject(new Error('TTS Canceled: ' + result.errorDetails));
                            }
                        },
                        (err) => reject(err)
                    );
                });

                yield audioChunk;
            }
        } catch (error) {
            console.error('AzureTTSService stream error:', error);
            throw error;
        }
    }

    close(): void {
        if (this.synthesizer) {
            this.synthesizer.close();
            this.synthesizer = null;
        }
    }
}
