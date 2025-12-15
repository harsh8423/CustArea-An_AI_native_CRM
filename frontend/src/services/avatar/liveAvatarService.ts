import { IAvatarService, AudioChunk } from '../types';
import { arrayBufferToBase64 } from '../utils';

type AvatarEvent = 'speaking_started' | 'speaking_ended' | 'disconnected';

export class LiveAvatarService implements IAvatarService {
    private ws: WebSocket | null = null;
    private livekitRoom: any = null; // Type as any to avoid importing livekit-client types globally if not needed
    private sessionData: any = null;
    private videoElement: HTMLElement | null = null;
    private listeners: Map<AvatarEvent, (() => void)[]> = new Map();
    private eventId = 0;

    constructor() {
        this.listeners.set('speaking_started', []);
        this.listeners.set('speaking_ended', []);
        this.listeners.set('disconnected', []);
    }

    on(event: AvatarEvent, listener: () => void): void {
        const current = this.listeners.get(event) || [];
        current.push(listener);
        this.listeners.set(event, current);
    }

    private emit(event: AvatarEvent) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(l => l());
        }
    }

    attachVideo(element: HTMLElement): void {
        this.videoElement = element;
        // If already connected and track exists, attach it now?
        // For now, we assume attachVideo is called before or during connection.
    }

    async connect(): Promise<void> {
        if (this.ws) return;

        try {
            // 1. Create Session
            const response = await fetch('/api/liveavatar/create-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'CUSTOM',
                    avatar_id: 'dc2935cf-5863-4f08-943b-c7478aea59fb',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create avatar session');
            }

            this.sessionData = await response.json();

            // 2. Connect WebSocket
            await this.initWebSocket(this.sessionData.ws_url);

            // 3. Connect LiveKit
            await this.initLiveKit(this.sessionData.livekit.url, this.sessionData.livekit.token);

        } catch (error) {
            console.error('[LiveAvatarService] Connect failed:', error);
            this.disconnect();
            throw error;
        }
    }

    private initWebSocket(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            this.ws = ws;

            ws.onopen = () => {
                console.log('[Avatar] WebSocket connected');
                resolve();
            };

            ws.onerror = (error) => {
                console.error('[Avatar] WebSocket error:', error);
                if (ws.readyState === WebSocket.CONNECTING) {
                    reject(error);
                }
            };

            ws.onclose = (event) => {
                console.log('[Avatar] WebSocket closed', event);
                this.emit('disconnected');
                this.ws = null;
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'avatar.speaking_started') {
                        this.emit('speaking_started');
                    } else if (message.type === 'avatar.speaking_ended') {
                        this.emit('speaking_ended');
                    }
                } catch (e) {
                    console.warn('[Avatar] Failed to parse message:', e);
                }
            };
        });
    }

    private async initLiveKit(url: string, token: string): Promise<void> {
        const { Room } = await import('livekit-client');
        const room = new Room();
        this.livekitRoom = room;

        room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
            console.log('[LiveKit] Track subscribed:', track.kind);

            if (track.kind === 'video') {
                if (this.videoElement) {
                    const element = track.attach();
                    element.style.width = '100%';
                    element.style.height = '100%';
                    element.style.objectFit = 'cover';
                    this.videoElement.innerHTML = '';
                    this.videoElement.appendChild(element);
                }
            } else if (track.kind === 'audio') {
                const element = track.attach();
                document.body.appendChild(element);
            }
        });

        room.on('disconnected', () => {
            console.log('[LiveKit] Disconnected');
            this.emit('disconnected');
        });

        await room.connect(url, token);
    }

    async speak(audio: AudioChunk): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[Avatar] WebSocket not ready to speak');
            return;
        }

        const base64Audio = arrayBufferToBase64(audio);
        const message = {
            type: 'agent.speak',
            event_id: `event_${this.eventId++}`,
            audio: base64Audio,
        };

        this.ws.send(JSON.stringify(message));
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.livekitRoom) {
            this.livekitRoom.disconnect();
            this.livekitRoom = null;
        }

        if (this.sessionData?.session_id) {
            try {
                await fetch(`/api/liveavatar/stop-session?session_id=${this.sessionData.session_id}`, {
                    method: 'DELETE',
                });
            } catch (e) {
                console.warn('Failed to stop session on server:', e);
            }
            this.sessionData = null;
        }
    }
}
