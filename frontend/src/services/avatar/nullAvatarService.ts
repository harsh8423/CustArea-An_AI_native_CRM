import { IAvatarService, AudioChunk } from '../types';

export class NullAvatarService implements IAvatarService {
    async connect(): Promise<void> {
        console.log('[NullAvatar] Connect called (Avatar disabled)');
    }

    async disconnect(): Promise<void> {
        console.log('[NullAvatar] Disconnect called');
    }

    async speak(audio: AudioChunk): Promise<void> {
        // Do nothing, or maybe log
        // console.log('[NullAvatar] Speak called (ignoring audio)');
    }

    on(event: string, listener: () => void): void {
        // No events to emit
    }

    attachVideo(element: HTMLElement): void {
        // Do nothing
        console.log('[NullAvatar] attachVideo called');
    }
}
