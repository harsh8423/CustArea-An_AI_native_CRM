import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export async function convertAzureAudioToPCM(audioResult: SpeechSDK.SynthesisResult): Promise<ArrayBuffer> {
    const audioData = (audioResult as any).audioData;

    if (!audioData) {
        throw new Error('No audio data found in synthesis result');
    }

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
    });

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

    // Get channel data and convert to PCM 16bit
    const channelData = audioBuffer.getChannelData(0);
    const pcmData = new Int16Array(channelData.length);

    for (let i = 0; i < channelData.length; i++) {
        // Convert float32 [-1, 1] to int16 [-32768, 32767]
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    return pcmData.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
