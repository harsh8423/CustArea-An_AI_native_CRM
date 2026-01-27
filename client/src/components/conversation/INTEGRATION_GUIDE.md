# Integration Guide for Unknown Contact Indicator

This guide shows how to integrate the new `UnknownContactIndicator` component into your conversation views.

## Components Created

### 1. `UnknownContactIndicator.tsx`

Located at: `client/src/components/conversation/UnknownContactIndicator.tsx`

Contains three reusable components:
- `UnknownContactBadge` - Displays "Not in Contact" warning badge
- `AddToContactsButton` - Button to create contact and link conversation
- `UnknownContactIndicator` - Combined component (easiest to use)

## Usage Examples

### In Conversation List

```typescript
import { UnknownContactIndicator } from '@/components/conversation/UnknownContactIndicator';

function ConversationListItem({ conversation }) {
    return (
        <div className="conversation-item">
            {/* Show contact name if exists, otherwise show unknown indicator */}
            {conversation.contact_id ? (
                <div className="contact-info">
                    <h3>{conversation.contact_name}</h3>
                    <p>{conversation.contact_email}</p>
                </div>
            ) : (
                <UnknownContactIndicator
                    conversation={conversation}
                    onContactAdded={() => refreshConversationList()}
                />
            )}
            
            {/* Rest of conversation item */}
        </div>
    );
}
```

### In Conversation Detail View

```typescript
import { UnknownContactIndicator } from '@/components/conversation/UnknownContactIndicator';

function ConversationHeader({ conversation }) {
    return (
        <header className="conversation-header">
            <UnknownContactIndicator
                conversation={conversation}
                onContactAdded={() => window.location.reload()}
                className="mb-4"
            />
            
            {/* Rest of header */}
        </header>
    );
}
```

### Using Individual Components

If you need more control, use the individual components:

```typescript
import { 
    UnknownContactBadge, 
    AddToContactsButton 
} from '@/components/conversation/UnknownContactIndicator';

function CustomLayout({ conversation }) {
    if (conversation.contact_id) return null;
    
    return (
        <div className="flex flex-col gap-2">
            {/* Just the badge */}
            <UnknownContactBadge
                senderDisplayName={conversation.sender_display_name}
                senderIdentifierType={conversation.sender_identifier_type}
                senderIdentifierValue={conversation.sender_identifier_value}
            />
            
            {/* Separate button elsewhere */}
            <AddToContactsButton
                conversationId={conversation.id}
                senderDisplayName={conversation.sender_display_name}
                senderIdentifierType={conversation.sender_identifier_type}
                senderIdentifierValue={conversation.sender_identifier_value}
                onContactAdded={() => console.log('Contact added!')}
            />
        </div>
    );
}
```

## API Response Format

Your backend now returns conversations with these new fields:

```typescript
{
    id: string;
    contact_id: string | null;  // NULL for unknown senders
    contact_name?: string;       // Only if contact_id exists
    contact_email?: string;      // Only if contact_id exists
    
    // NEW fields for unknown senders:
    sender_display_name?: string;      // Display name (email, phone, or name)
    sender_identifier_type?: string;   // 'email', 'phone', 'whatsapp', 'visitor_id'
    sender_identifier_value?: string;  // Actual email/phone value
    
    // ... other conversation fields
}
```

## Styling

The components use Tailwind CSS classes. You can customize by:

1. **Changing badge color** - Edit `UnknownContactBadge` component
2. **Adding custom className** - Pass to any component
3. **Overriding styles** - Use your own CSS classes

Example custom styling:

```typescript
<UnknownContactIndicator
    conversation={conversation}
    onContactAdded={handleRefresh}
    className="my-custom-container-class"
/>
```

## Testing Checklist

After integration, test these scenarios:

- [ ] **Email from unknown sender**
  - Verify badge shows "Not in Contact"
  - Verify sender email is displayed
  - Click "Add to Contacts" button
  - Verify contact is created
  - Verify badge disappears after contact created

- [ ] **WhatsApp from unknown number**
  - Verify phone number is displayed
  - Verify badge shows
  - Test contact creation

- [ ] **Known contact**
  - Verify NO badge shows
  - Verify contact name displays normally

- [ ] **Edge cases**
  - Empty sender_display_name
  - Missing identifier values
  - API errors during contact creation

## Notes

- The "Add to Contacts" button automatically fills in the contact data based on the sender identifier
- After creating a contact, you should refresh the conversation list to show updated data
- The component is SSR-safe (uses "use client" directive)
- All API calls use relative paths (/api/...) for Next.js compatibility
