"use client";

import { X } from "lucide-react";
import { EmailComposer } from "./EmailComposer";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ReplyDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: string;
    defaultSubject?: string;
    recipientEmail: string;
    onSent: () => void;
}

export function ReplyDrawer({
    isOpen,
    onClose,
    conversationId,
    defaultSubject,
    recipientEmail,
    onSent
}: ReplyDrawerProps) {
    const [shouldRender, setShouldRender] = useState(false);
    const [animateOpen, setAnimateOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to ensure component is mounted before starting animation
            // This allows the browser to paint the initial 'closed' state (translate-y-full)
            // before transitioning to 'open' state (translate-y-0)
            const timer = setTimeout(() => setAnimateOpen(true), 50);
            return () => clearTimeout(timer);
        } else {
            setAnimateOpen(false);
            // Wait for animation to finish before unmounting
            const timer = setTimeout(() => setShouldRender(false), 700); // Match duration-700
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-700",
                    animateOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] z-50 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] transform border-t border-gray-100",
                    animateOpen ? "translate-y-0" : "translate-y-full"
                )}
                style={{ maxHeight: '85vh' }}
            >
                <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
                    {/* Handle for dragging (visual cue) */}
                    <div className="flex justify-center pt-4 pb-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="px-8 py-2 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Reply to Conversation</h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-6 overflow-y-auto">
                        <EmailComposer
                            conversationId={conversationId}
                            defaultSubject={defaultSubject}
                            recipientEmail={recipientEmail}
                            onSent={() => {
                                onSent();
                                onClose();
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
