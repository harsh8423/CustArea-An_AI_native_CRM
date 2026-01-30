'use client';

import React, { useState, useEffect, useRef } from 'react';
import copilotApi, {
    type CopilotMessage,
    type QuickAction,
} from '@/lib/api/copilot';
import {
    Sparkles,
    ArrowUp,
    Zap,
    MessageSquare,
    Search,
    ListTodo,
    Loader2,
    Copy,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CopilotPanelProps {
    conversationId: string;
    contactId?: string;
    channel: string;
    onReplyGenerated?: (draft: string) => void;
}

export default function CopilotPanel({
    conversationId,
    contactId,
    channel,
    onReplyGenerated,
}: CopilotPanelProps) {
    const [messages, setMessages] = useState<CopilotMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load session messages on mount
    useEffect(() => {
        loadSession();
        loadQuickActions();
    }, [conversationId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadSession = async () => {
        try {
            const response = await copilotApi.getSession(conversationId);
            if (response.success && response.messages) {
                setMessages(response.messages);
            }
        } catch (error) {
            console.error('Failed to load Copilot session:', error);
        }
    };

    const loadQuickActions = async () => {
        try {
            const response = await copilotApi.getQuickActions(conversationId);
            if (response.success) {
                setQuickActions(response.quickActions);
            }
        } catch (error) {
            console.error('Failed to load quick actions:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: CopilotMessage = {
            role: 'user',
            content: inputValue,
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        // Reset height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        try {
            const response = await copilotApi.chat({
                conversationId,
                query: inputValue,
                contactId,
            });

            const assistantMessage: CopilotMessage = {
                role: 'assistant',
                content: response.response,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message to Copilot:', error);
            const errorMessage: CopilotMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = async (actionId: string) => {
        setIsLoading(true);

        try {
            switch (actionId) {
                case 'generate_professional_reply':
                case 'generate_email_reply':
                    const replyResponse = await copilotApi.generateReply({
                        conversationId,
                        tone: 'professional',
                        contactId,
                    });

                    if (replyResponse.success) {
                        const message: CopilotMessage = {
                            role: 'assistant',
                            content: `Here's a professional reply draft:\n\n${replyResponse.draft}`,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, message]);
                        if (onReplyGenerated) {
                            onReplyGenerated(replyResponse.draft);
                        }
                    }
                    break;

                case 'summarize_brief':
                    const summaryResponse = await copilotApi.summarize({
                        conversationId,
                        summaryType: 'brief',
                        contactId,
                    });

                    if (summaryResponse.success) {
                        const message: CopilotMessage = {
                            role: 'assistant',
                            content: `**Conversation Summary:**\n\n${summaryResponse.summary}`,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, message]);
                    }
                    break;

                case 'find_related':
                    const searchResponse = await copilotApi.crossChannelSearch({
                        contactId,
                        limit: 10,
                    });

                    if (searchResponse.success) {
                        const channelCounts = Object.entries(
                            searchResponse.groupedByChannel
                        )
                            .map(([channel, convs]) => `- ${channel}: ${convs.length}`)
                            .join('\n');

                        const message: CopilotMessage = {
                            role: 'assistant',
                            content: `**Related Conversations (${searchResponse.totalCount} total):**\n\n${channelCounts || 'No related conversations found.'}`,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, message]);
                    }
                    break;

                case 'extract_action_items':
                    const actionItemsResponse = await copilotApi.summarize({
                        conversationId,
                        summaryType: 'action_items',
                        contactId,
                    });

                    if (actionItemsResponse.success) {
                        const message: CopilotMessage = {
                            role: 'assistant',
                            content: `**Action Items:**\n\n${actionItemsResponse.summary}`,
                            timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, message]);
                    }
                    break;
            }
        } catch (error) {
            console.error('Quick action failed:', error);
            const errorMessage: CopilotMessage = {
                role: 'assistant',
                content: 'Sorry, that action failed. Please try again.',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };



    // Helper for textarea auto-resize
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const getQuickActionIcon = (icon: string) => {
        switch (icon) {
            case 'sparkles': return Zap; // Changed to Zap for a punchier look
            case 'mail': return MessageSquare;
            case 'document-text': return ListTodo;
            case 'search': return Search;
            default: return Sparkles;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans text-xs">
            {/* Quick Actions - Compact Chips */}
            {quickActions.length > 0 && messages.length === 0 && (
                <div className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {quickActions.slice(0, 4).map((action) => {
                            const Icon = getQuickActionIcon(action.icon);
                            return (
                                <button
                                    key={action.id}
                                    onClick={() => handleQuickAction(action.id)}
                                    disabled={isLoading}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-100 bg-gray-50',
                                        'hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all duration-200',
                                        'text-gray-600 shadow-sm text-[10px] font-medium'
                                    )}
                                >
                                    <Icon className="h-3 w-3" />
                                    <span>{action.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40 hover:opacity-100 transition-opacity duration-500">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-100 to-blue-100 flex items-center justify-center mb-3 shadow-[0_4px_20px_-4px_rgba(168,85,247,0.2)]">
                            <Sparkles className="h-6 w-6 text-purple-500" />
                        </div>
                        <p className="text-gray-400 font-medium">How can I help you today?</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={cn(
                                    'group relative flex w-full flex-col',
                                    message.role === 'user' ? 'items-end' : 'items-start'
                                )}
                            >
                                <div
                                    className={cn(
                                        'max-w-[98%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed break-words',
                                        message.role === 'user'
                                            ? 'bg-gray-900 text-white rounded-br-md shadow-md' // User: Dark Grey
                                            : 'bg-gray-50/80 text-gray-800 rounded-bl-md' // Assistant: Soft Gray, no border
                                    )}
                                >
                                    {message.role === 'assistant' ? (
                                        <div className="markdown-body prose prose-xs prose-p:my-1 prose-headings:my-2 max-w-none text-gray-700">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                    )}

                                    {/* Copy Button (only for assistant) removed */}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 px-3 py-2">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area - Floated & Modern */}
            <div className="p-3 bg-white/80 backdrop-blur-sm">
                <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-[24px] px-1 py-1 pr-1.5 shadow-sm focus-within:ring-2 focus-within:ring-purple-100/50 focus-within:border-purple-200 transition-all duration-300">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInput}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Ask Copilot..."
                        disabled={isLoading}
                        rows={1}
                        className="flex-1 max-h-32 min-h-[36px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[12px] px-3 py-2.5 placeholder:text-gray-400 resize-none text-gray-800"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 mb-[2px]',
                            inputValue.trim() && !isLoading
                                ? 'bg-black text-white shadow-md hover:scale-105 active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
