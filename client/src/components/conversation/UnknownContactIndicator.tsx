"use client";

import React from 'react';
import { UserPlus } from 'lucide-react';

interface UnknownContactBadgeProps {
    senderDisplayName: string;
    senderIdentifierType?: string;
    senderIdentifierValue?: string;
    className?: string;
}

/**
 * Badge component to display when a conversation is from an unknown sender
 * Shows "Not in Contact" indicator with sender information
 */
export function UnknownContactBadge({
    senderDisplayName,
    senderIdentifierType,
    senderIdentifierValue,
    className = ""
}: UnknownContactBadgeProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Not in Contact
            </span>
            <span className="text-sm text-gray-600">
                {senderDisplayName || senderIdentifierValue || 'Unknown'}
            </span>
        </div>
    );
}

interface AddToContactsButtonProps {
    conversationId: string;
    senderDisplayName?: string;
    senderIdentifierType?: string;
    senderIdentifierValue?: string;
    onContactAdded?: () => void;
    className?: string;
}

/**
 * Button component to add an unknown sender to contacts
 * Opens modal to create contact and link to conversation
 */
export function AddToContactsButton({
    conversationId,
    senderDisplayName,
    senderIdentifierType,
    senderIdentifierValue,
    onContactAdded,
    className = ""
}: AddToContactsButtonProps) {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleAddContact = async () => {
        setIsLoading(true);
        try {
            // Create contact
            const contactData: any = {
                name: senderDisplayName || senderIdentifierValue || 'Unknown',
                source: senderIdentifierType || 'manual'
            };

            // Add identifier based on type
            if (senderIdentifierType === 'email') {
                contactData.email = senderIdentifierValue;
            } else if (senderIdentifierType === 'phone' || senderIdentifierType === 'whatsapp') {
                contactData.phone = senderIdentifierValue?.replace('whatsapp:', '');
            }

            const createResponse = await fetch('http://localhost:8000/api/contacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(contactData)
            });

            if (!createResponse.ok) {
                throw new Error('Failed to create contact');
            }

            const { contact } = await createResponse.json();

            // Link conversation to new contact
            const linkResponse = await fetch(`http://localhost:8000/api/conversations/${conversationId}/link-contact`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ contactId: contact.id })
            });

            if (!linkResponse.ok) {
                throw new Error('Failed to link conversation');
            }

            // Callback to refresh conversation list
            onContactAdded?.();

            // Show success message (you can integrate with your toast system)
            alert('Contact created and linked successfully!');


        } catch (error: any) {
            console.error('Error adding contact:', error);
            const errorMessage = error.message || 'Unknown error';
            alert(`Failed to add contact: ${errorMessage}. Check console for details.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleAddContact}
            disabled={isLoading}
            className={`inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            <UserPlus className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Adding...' : 'Add to Contacts'}
        </button>
    );
}

/**
 * Combined component that shows badge AND button for unknown contacts
 */
interface UnknownContactIndicatorProps {
    conversation: {
        id: string;
        contact_id: string | null;
        sender_display_name?: string;
        sender_identifier_type?: string;
        sender_identifier_value?: string;
        contact_name?: string;
    };
    onContactAdded?: () => void;
    className?: string;
}

export function UnknownContactIndicator({
    conversation,
    onContactAdded,
    className = ""
}: UnknownContactIndicatorProps) {
    // Only show if conversation doesn't have a contact
    if (conversation.contact_id) {
        return null;
    }

    return (
        <div className={`flex items-center justify-between gap-3 ${className}`}>
            <UnknownContactBadge
                senderDisplayName={conversation.sender_display_name || ''}
                senderIdentifierType={conversation.sender_identifier_type}
                senderIdentifierValue={conversation.sender_identifier_value}
            />
            <AddToContactsButton
                conversationId={conversation.id}
                senderDisplayName={conversation.sender_display_name}
                senderIdentifierType={conversation.sender_identifier_type}
                senderIdentifierValue={conversation.sender_identifier_value}
                onContactAdded={onContactAdded}
            />
        </div>
    );
}
