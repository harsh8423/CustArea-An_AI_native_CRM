export type AudioChunk = ArrayBuffer;
export type TextChunk = string;

export interface ISTTService {
    start(): Promise<void>;
    stop(): Promise<void>;
    on(event: 'speech_recognized', listener: (text: string) => void): void;
    on(event: 'speech_hypothesizing', listener: (text: string) => void): void; // For partial results
    close(): void;
}

export interface ILLMService {
    generateStream(prompt: string): AsyncGenerator<string, void, unknown>;
}

export interface ITTSService {
    speakStream(textStream: AsyncGenerator<string>): AsyncGenerator<AudioChunk, void, unknown>;
    speak(text: string): Promise<AudioChunk>;
    close(): void;
}

export interface IAvatarService {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    speak(audio: AudioChunk): Promise<void>;
    on(event: 'speaking_started' | 'speaking_ended' | 'disconnected', listener: () => void): void;
    attachVideo(element: HTMLElement): void;
}
