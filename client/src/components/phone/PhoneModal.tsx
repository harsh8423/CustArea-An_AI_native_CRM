'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Phone, PhoneOff, PhoneIncoming, PhoneOutgoing,
    Mic, MicOff, X, Loader2, User, Bot, Sparkles
} from 'lucide-react';
import { Device, Call } from '@twilio/voice-sdk';
import { cn } from '@/lib/utils';

const API_BASE = 'http://localhost:8000/api/phone';

interface PhoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCallStart?: (callInfo: any) => void;
    onCallEnd?: (callInfo: any) => void;
    prefillPhone?: string;  // Pre-filled phone number from URL params
    contactId?: string;  // Contact ID for tracking
    contactName?: string;  // Contact name for display
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'incoming';
type CallMode = 'human' | 'ai';

export default function PhoneModal({ isOpen, onClose, onCallStart, onCallEnd, prefillPhone, contactId, contactName }: PhoneModalProps) {
    const [callState, setCallState] = useState<CallState>('idle');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [callerInfo, setCallerInfo] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [callMode, setCallMode] = useState<CallMode>('human');
    const [customInstruction, setCustomInstruction] = useState('');

    const deviceRef = useRef<Device | null>(null);
    const callRef = useRef<Call | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Track if modal should stay open during call
    const [forceOpen, setForceOpen] = useState(false);

    // Callback refs to get latest values in event handlers
    const callStateRef = useRef(callState);
    callStateRef.current = callState;

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
            console.log('[PhoneModal] Got token for identity:', identity);

            const device = new Device(accessToken, {
                logLevel: 1,
                codecPreferences: ['opus', 'pcmu'] as any,
            });

            // Handle incoming calls
            device.on('incoming', (call: Call) => {
                console.log('[PhoneModal] *** INCOMING CALL ***');
                console.log('[PhoneModal] From:', call.parameters.From);

                callRef.current = call;
                setCallerInfo(call.parameters.From || 'Unknown');
                setCallState('incoming');
                setForceOpen(true); // Force modal open for incoming call

                call.on('cancel', () => {
                    console.log('[PhoneModal] Incoming call cancelled');
                    resetState();
                });
            });

            device.on('registered', () => {
                console.log('[PhoneModal] Device registered');
                setIsInitialized(true);
                setError(null);
            });

            device.on('error', (err: any) => {
                console.error('[PhoneModal] Device error:', err);
                setError(err.message || 'Device error');
            });

            device.on('tokenWillExpire', async () => {
                const resp = await fetch(`${API_BASE}/token`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const { token: newToken } = await resp.json();
                device.updateToken(newToken);
            });

            await device.register();
            deviceRef.current = device;

        } catch (err: any) {
            console.error('[PhoneModal] Failed to initialize:', err);
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

    // Pre-fill phone number when provided (from contact page navigation)
    useEffect(() => {
        if (isOpen && prefillPhone) {
            setPhoneNumber(prefillPhone);
        }
    }, [isOpen, prefillPhone]);

    // Timer functions
    const startTimer = () => {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration(d => d + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Reset state
    const resetState = () => {
        setCallState('idle');
        setCallerInfo('');
        setIsMuted(false);
        setForceOpen(false);
        stopTimer();
        callRef.current = null;
    };

    // Make outbound call (Human)
    const makeHumanCall = async () => {
        if (!deviceRef.current || !phoneNumber) return;

        setCallState('connecting');
        setError(null);
        setForceOpen(true);

        try {
            const call = await deviceRef.current.connect({
                params: { To: phoneNumber }
            });

            callRef.current = call;
            setCallerInfo(phoneNumber);

            call.on('accept', () => {
                setCallState('in-call');
                startTimer();
                onCallStart?.({ number: phoneNumber, direction: 'outbound', mode: 'human' });
            });

            call.on('disconnect', () => {
                handleCallEnd();
            });

            call.on('error', (err: any) => {
                setError(err.message);
                resetState();
            });

            call.on('ringing', () => {
                setCallState('ringing');
            });

        } catch (err: any) {
            setError(err.message || 'Failed to connect call');
            resetState();
        }
    };

    // Make outbound call (AI)
    const makeAICall = async () => {
        if (!phoneNumber) return;

        setCallState('connecting');
        setError(null);
        setForceOpen(true);
        setCallerInfo(phoneNumber);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    contactId: contactId,
                    customInstruction: customInstruction || undefined
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to initiate AI call');
            }

            const data = await response.json();
            console.log('[PhoneModal] AI call initiated:', data);

            setCallState('in-call');
            startTimer();
            onCallStart?.({ number: phoneNumber, direction: 'outbound', mode: 'ai', callSid: data.callSid });

            // AI calls are handled server-side, so we close the modal immediately  
            // The call will continue in the background via Twilio
            setTimeout(() => {
                resetState();
                onClose();
            }, 500); // Small delay to show "in-call" state briefly

        } catch (err: any) {
            setError(err.message || 'Failed to initiate AI call');
            resetState();
        }
    };

    // Handle call end
    const handleCallEnd = () => {
        stopTimer();
        onCallEnd?.({ duration: callDuration, number: callerInfo || phoneNumber });
        resetState();
    };

    // Answer incoming call
    const answerCall = async () => {
        if (!callRef.current) return;

        const call = callRef.current;

        call.on('disconnect', () => {
            handleCallEnd();
        });

        call.on('error', (err: any) => {
            setError(err.message);
            resetState();
        });

        call.accept();
        setCallState('in-call');
        startTimer();
        onCallStart?.({ number: callerInfo, direction: 'inbound' });

        // Resume audio context
        try {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const audioCtx = new AudioContext();
                if (audioCtx.state === 'suspended') await audioCtx.resume();
            }
        } catch (e) { }
    };

    // Reject incoming call
    const rejectCall = () => {
        if (callRef.current) {
            callRef.current.reject();
        }
        resetState();
    };

    // Hangup call
    const hangupCall = () => {
        if (callRef.current) {
            callRef.current.disconnect();
        }
        handleCallEnd();
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

    // Handle dial pad
    const handleDialPadPress = (digit: string) => {
        setPhoneNumber(prev => prev + digit);
        if (callRef.current && callState === 'in-call') {
            callRef.current.sendDigits(digit);
        }
    };

    // Should modal be shown?
    const shouldShow = isOpen || forceOpen;

    if (!shouldShow) return null;

    // Prevent closing during active call
    const handleClose = () => {
        if (callState === 'idle') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5" />
                            <span className="font-semibold">
                                {callState === 'incoming' ? 'Incoming Call' :
                                    callState === 'in-call' ? 'On Call' :
                                        callState === 'connecting' || callState === 'ringing' ? 'Calling...' :
                                            'Phone'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isInitialized ? (
                                <span className="w-2 h-2 bg-green-400 rounded-full" title="Ready" />
                            ) : (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {callState === 'idle' && (
                                <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="px-4 py-2 bg-red-50 text-red-600 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Content */}
                {callState === 'incoming' ? (
                    // Incoming call view
                    <div className="p-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <PhoneIncoming className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-gray-500 text-sm">Incoming call from</p>
                        <p className="font-semibold text-xl text-gray-900">{callerInfo}</p>

                        <div className="flex gap-4 mt-6 justify-center">
                            <button
                                onClick={rejectCall}
                                className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                            <button
                                onClick={answerCall}
                                className="p-4 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                                <Phone className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                ) : callState === 'in-call' ? (
                    // In-call view
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            {callMode === 'ai' ? (
                                <Bot className="w-8 h-8 text-green-600" />
                            ) : (
                                <User className="w-8 h-8 text-green-600" />
                            )}
                        </div>
                        <p className="font-semibold text-gray-900">{callerInfo}</p>
                        <p className="text-3xl font-mono text-gray-600 mt-2">{formatDuration(callDuration)}</p>
                        {callMode === 'ai' && (
                            <p className="text-sm text-purple-600 flex items-center justify-center gap-1 mt-2">
                                <Sparkles className="w-4 h-4" />
                                AI Agent Handling Call
                            </p>
                        )}

                        <div className="flex justify-center gap-4 mt-6">
                            {callMode === 'human' && (
                                <button
                                    onClick={toggleMute}
                                    className={cn(
                                        "p-4 rounded-full transition-colors",
                                        isMuted ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    )}
                                >
                                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>
                            )}
                            <button
                                onClick={hangupCall}
                                className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                ) : callState === 'connecting' || callState === 'ringing' ? (
                    // Connecting/Ringing view
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <PhoneOutgoing className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="font-semibold text-gray-900">
                            {callState === 'connecting' ? 'Connecting...' : 'Ringing...'}
                        </p>
                        <p className="text-gray-500 mt-1">{callerInfo}</p>
                        {callMode === 'ai' && (
                            <p className="text-sm text-purple-600 flex items-center justify-center gap-1 mt-2">
                                <Sparkles className="w-4 h-4" />
                                AI Agent will handle call
                            </p>
                        )}
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
                        {/* Call Mode Toggle */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-4">
                            <button
                                onClick={() => setCallMode('human')}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                                    callMode === 'human'
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <User className="w-4 h-4" />
                                Human Call
                            </button>
                            <button
                                onClick={() => setCallMode('ai')}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                                    callMode === 'ai'
                                        ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <Bot className="w-4 h-4" />
                                AI Call
                            </button>
                        </div>

                        {/* Custom Instruction (AI Mode Only) */}
                        {callMode === 'ai' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Custom Instructions (Optional)
                                </label>
                                <textarea
                                    value={customInstruction}
                                    onChange={(e) => setCustomInstruction(e.target.value)}
                                    placeholder="e.g., Be very brief, max 10 words per response"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm resize-none"
                                    rows={2}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    These instructions will be prioritized in the AI's behavior for this call
                                </p>
                            </div>
                        )}

                        {/* Number input */}
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="w-full text-center text-xl font-mono py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 mb-4"
                        />

                        {/* Dial pad */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                                <button
                                    key={digit}
                                    onClick={() => handleDialPadPress(digit)}
                                    className="py-3 text-xl font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    {digit}
                                </button>
                            ))}
                        </div>

                        {/* Call button */}
                        <button
                            onClick={callMode === 'ai' ? makeAICall : makeHumanCall}
                            disabled={!phoneNumber || (!isInitialized && callMode === 'human')}
                            className={cn(
                                "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                                callMode === 'ai'
                                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50"
                                    : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
                            )}
                        >
                            {callMode === 'ai' ? <Bot className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                            {callMode === 'ai' ? 'AI Call' : 'Call'}
                        </button>

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
        </div>
    );
}

// Export a trigger button component as well
export function PhoneButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-sm"
        >
            <Phone className="w-4 h-4" />
            Call
        </button>
    );
}
