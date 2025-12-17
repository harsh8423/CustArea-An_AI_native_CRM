'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Phone, PhoneOff, PhoneIncoming, PhoneOutgoing,
    Mic, MicOff, Volume2, VolumeX, X, Loader2,
    User, Clock, Minimize2, Maximize2
} from 'lucide-react';
import { Device, Call } from '@twilio/voice-sdk';

const API_BASE = 'http://localhost:8000/api/phone';

interface PhoneDialerProps {
    onCallStart?: (callInfo: any) => void;
    onCallEnd?: (callInfo: any) => void;
}

type DialerState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'incoming';

export default function PhoneDialer({ onCallStart, onCallEnd }: PhoneDialerProps) {
    const [dialerState, setDialerState] = useState<DialerState>('idle');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callerInfo, setCallerInfo] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [speakerEnabled, setSpeakerEnabled] = useState(true);

    const deviceRef = useRef<Device | null>(null);
    const callRef = useRef<Call | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize Twilio Device
    const initializeDevice = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/token`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to get token');
            }

            const { token: accessToken, identity } = await response.json();
            console.log('[Dialer] Got token for identity:', identity);

            // Create new device - keep it simple for debugging
            const device = new Device(accessToken, {
                logLevel: 'debug' as any, // Maximum logging for debugging
                codecPreferences: ['opus', 'pcmu'] as any,
            });

            // Handle incoming calls - this is critical!
            device.on('incoming', (call: Call) => {
                console.log('[Dialer] *** INCOMING CALL ***');
                console.log('[Dialer] From:', call.parameters.From);
                console.log('[Dialer] To:', call.parameters.To);
                console.log('[Dialer] CallSid:', call.parameters.CallSid);

                callRef.current = call;
                setCallerInfo(call.parameters.From || 'Unknown');
                setDialerState('incoming');

                // Only handle cancel event here - this happens when caller hangs up before we answer
                call.on('cancel', () => {
                    console.log('[Dialer] Incoming call cancelled by caller');
                    setDialerState('idle');
                    setCallerInfo('');
                    callRef.current = null;
                });
                
                // NOTE: disconnect event is handled in answerCall after we accept
                // Do NOT add disconnect handler here - it will interfere with in-call state
            });

            device.on('registered', () => {
                console.log('[Dialer] *** DEVICE REGISTERED SUCCESSFULLY ***');
                console.log('[Dialer] Identity:', identity);
                console.log('[Dialer] Now ready to receive incoming calls');
                setIsInitialized(true);
                setError(null);
            });

            device.on('unregistered', () => {
                console.log('[Dialer] Device UNREGISTERED');
                setIsInitialized(false);
            });

            device.on('registering', () => {
                console.log('[Dialer] Device registering...');
            });

            device.on('error', (err: any) => {
                console.error('[Dialer] Device error:', err);
                console.error('[Dialer] Error code:', err.code);
                console.error('[Dialer] Error message:', err.message);
                setError(err.message || 'Device error');
            });

            device.on('tokenWillExpire', async () => {
                console.log('[Dialer] Token expiring, refreshing...');
                const resp = await fetch(`${API_BASE}/token`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const { token: newToken } = await resp.json();
                device.updateToken(newToken);
            });

            // Register the device to receive incoming calls
            console.log('[Dialer] Calling device.register()...');
            await device.register();
            console.log('[Dialer] device.register() completed');
            deviceRef.current = device;

        } catch (err: any) {
            console.error('[Dialer] Failed to initialize:', err);
            setError(err.message || 'Failed to initialize phone');
        }
    }, []);

    useEffect(() => {
        initializeDevice();
        return () => {
            deviceRef.current?.destroy();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [initializeDevice]);

    // Start call timer
    const startTimer = () => {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration(d => d + 1);
        }, 1000);
    };

    // Stop call timer
    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Reset state after call ends
    const resetState = () => {
        setDialerState('idle');
        setCallerInfo('');
        setIsMuted(false);
        stopTimer();
        callRef.current = null;
    };

    // Handle call end
    const handleCallEnd = () => {
        stopTimer();
        onCallEnd?.({ duration: callDuration, number: callerInfo || phoneNumber });
        resetState();
    };

    // Make outbound call
    const makeCall = async () => {
        if (!deviceRef.current || !phoneNumber) return;

        setDialerState('connecting');
        setError(null);

        try {
            const call = await deviceRef.current.connect({
                params: { To: phoneNumber }
            });

            callRef.current = call;
            setCallerInfo(phoneNumber);

            // CRITICAL: Handle audio volume to confirm audio is working
            call.on('volume', (inputVolume: number, outputVolume: number) => {
                // Log volume levels periodically to debug audio
                if (outputVolume > 0) {
                    console.log('[Dialer] Audio output detected:', outputVolume);
                }
            });

            // Get the remote audio stream when call connects
            call.on('accept', () => {
                console.log('[Dialer] Call accepted');
                setDialerState('in-call');
                startTimer();
                onCallStart?.({ number: phoneNumber, direction: 'outbound' });

                // Log audio device info
                console.log('[Dialer] Call status:', call.status());

                // Access the audio element directly if available
                const audioContext = (call as any)._audioContext;
                if (audioContext) {
                    console.log('[Dialer] AudioContext state:', audioContext.state);
                    // Resume audio context if suspended (needed for some browsers)
                    if (audioContext.state === 'suspended') {
                        audioContext.resume().then(() => {
                            console.log('[Dialer] AudioContext resumed');
                        });
                    }
                }
            });

            call.on('disconnect', () => {
                console.log('[Dialer] Call disconnected');
                handleCallEnd();
            });

            call.on('cancel', () => {
                console.log('[Dialer] Call cancelled');
                resetState();
            });

            call.on('error', (err: any) => {
                console.error('[Dialer] Call error:', err);
                setError(err.message);
                resetState();
            });

            // Add ringing event for better UX
            call.on('ringing', () => {
                console.log('[Dialer] Call is ringing');
                setDialerState('ringing');
            });

            setDialerState('ringing');

        } catch (err: any) {
            console.error('[Dialer] Failed to connect:', err);
            setError(err.message || 'Failed to connect call');
            setDialerState('idle');
        }
    };

    // Answer incoming call
    const answerCall = async () => {
        if (!callRef.current) {
            console.error('[Dialer] No call to answer');
            return;
        }

        const call = callRef.current;
        console.log('[Dialer] Answering call...');

        // Set up event handlers before accepting
        call.on('disconnect', () => {
            console.log('[Dialer] Answered call disconnected');
            stopTimer();
            setDialerState('idle');
            setCallerInfo('');
            setIsMuted(false);
            callRef.current = null;
        });

        call.on('error', (err: any) => {
            console.error('[Dialer] Call error:', err);
            setError(err.message);
            stopTimer();
            setDialerState('idle');
            callRef.current = null;
        });

        // Accept the call
        call.accept();

        // Update state
        setDialerState('in-call');
        startTimer();
        onCallStart?.({ number: callerInfo, direction: 'inbound' });

        console.log('[Dialer] Call accepted, status:', call.status());

        // Resume audio context if needed (browser policy)
        try {
            // Force audio playback by interacting with the audio context
            if ((window as any).AudioContext || (window as any).webkitAudioContext) {
                const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContext();
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                    console.log('[Dialer] Audio context resumed');
                }
            }
        } catch (e) {
            console.log('[Dialer] Audio context handling:', e);
        }
    };

    // Reject incoming call
    const rejectCall = () => {
        if (!callRef.current) return;
        console.log('[Dialer] Rejecting call...');
        callRef.current.reject();
        setDialerState('idle');
        setCallerInfo('');
        callRef.current = null;
    };

    // Hangup call
    const hangupCall = () => {
        console.log('[Dialer] Hanging up...');
        if (callRef.current) {
            callRef.current.disconnect();
        }
        stopTimer();
        setDialerState('idle');
        setCallerInfo('');
        setIsMuted(false);
        callRef.current = null;
        onCallEnd?.({ duration: callDuration, number: callerInfo || phoneNumber });
    };

    // Toggle mute
    const toggleMute = () => {
        if (callRef.current) {
            const newMuted = !isMuted;
            callRef.current.mute(newMuted);
            setIsMuted(newMuted);
        }
    };

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Dial pad input
    const handleDialPadPress = (digit: string) => {
        setPhoneNumber(prev => prev + digit);
        if (callRef.current && dialerState === 'in-call') {
            callRef.current.sendDigits(digit);
        }
    };

    // Incoming call UI
    if (dialerState === 'incoming') {
        return (
            <div className="fixed bottom-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-pulse">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <PhoneIncoming className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold">Incoming Call</p>
                                <p className="text-sm opacity-90">{callerInfo}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 flex gap-3">
                    <button
                        onClick={rejectCall}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <PhoneOff className="w-5 h-5" />
                        Decline
                    </button>
                    <button
                        onClick={answerCall}
                        className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <Phone className="w-5 h-5" />
                        Answer
                    </button>
                </div>
            </div>
        );
    }

    // In-call UI (minimized)
    if (dialerState === 'in-call' && isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-4 z-50">
                <div className="flex items-center gap-4 text-white">
                    <div className="flex items-center gap-2">
                        <Phone className="w-5 h-5" />
                        <span className="font-mono">{formatDuration(callDuration)}</span>
                    </div>
                    <button onClick={() => setIsMinimized(false)} className="p-2 hover:bg-white/20 rounded-lg">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button onClick={hangupCall} className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
                        <PhoneOff className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Main dialer UI
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5" />
                        <span className="font-semibold">Phone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isInitialized ? (
                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        ) : (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {dialerState === 'in-call' && (
                            <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/20 rounded">
                                <Minimize2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* Content based on state */}
            {dialerState === 'in-call' ? (
                // In-call view
                <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{callerInfo}</p>
                    <p className="text-2xl font-mono text-gray-600 mt-2">{formatDuration(callDuration)}</p>

                    <div className="flex justify-center gap-4 mt-6">
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        <button
                            onClick={hangupCall}
                            className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                            <PhoneOff className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            ) : dialerState === 'connecting' || dialerState === 'ringing' ? (
                // Connecting view
                <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <PhoneOutgoing className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="font-semibold text-gray-900">
                        {dialerState === 'connecting' ? 'Connecting...' : 'Ringing...'}
                    </p>
                    <p className="text-gray-500 mt-1">{callerInfo}</p>
                    <button
                        onClick={hangupCall}
                        className="mt-6 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                // Idle - Dial pad view
                <div className="p-4">
                    {/* Number input */}
                    <div className="mb-4">
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="w-full text-center text-xl font-mono py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                    </div>

                    {/* Dial pad */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                            <button
                                key={digit}
                                onClick={() => handleDialPadPress(digit)}
                                className="py-4 text-xl font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                {digit}
                            </button>
                        ))}
                    </div>

                    {/* Call button */}
                    <button
                        onClick={makeCall}
                        disabled={!phoneNumber || !isInitialized}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Phone className="w-5 h-5" />
                        Call
                    </button>

                    {/* Clear button */}
                    {phoneNumber && (
                        <button
                            onClick={() => setPhoneNumber('')}
                            className="w-full mt-2 py-2 text-gray-500 hover:text-gray-700 text-sm"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
