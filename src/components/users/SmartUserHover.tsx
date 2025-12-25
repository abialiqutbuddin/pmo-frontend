import React from 'react';
import { UserHoverCard } from '../users/UserHoverCard';
import { useChatStore } from '../../store/chatStore';

export const SmartUserHover: React.FC<{ userId: string; name: string; roomId: string }> = ({ userId, name, roomId }) => {
    const participants = useChatStore(s => s.participants[roomId] || {});
    const user = participants[userId];

    // If user found in chat, use that data
    // Fallback to minimal data
    const userData = user ? {
        id: userId,
        fullName: user.fullName || user.email || name,
        email: user.email,
        profileImage: user.profileImage,
        role: (user as any).role // Type definition might missing role but data might have it, or remove if not needed.
    } : { id: userId, fullName: name };

    // For hover logic, we can use simple CSS group hover
    // But UserHoverCard is a bit heavy, maybe just render it conditionally?
    const [hovering, setHovering] = React.useState(false);

    return (
        <span
            className="relative inline-block text-blue-600 font-medium cursor-pointer"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            @{name}
            {hovering && (
                <div className="absolute bottom-full left-0 mb-1 z-50">
                    <UserHoverCard user={userData} />
                </div>
            )}
        </span>
    );
};
