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
    const triggerRef = React.useRef<HTMLSpanElement>(null);
    const [pos, setPos] = React.useState<{ vertical: 'top' | 'bottom'; horizontal: 'left' | 'right' }>({ vertical: 'top', horizontal: 'left' });

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const bottomSpace = window.innerHeight - rect.bottom;
            const topSpace = rect.top;
            const rightSpace = window.innerWidth - rect.left; // space from left edge to right screen edge? No.
            // actually we want space available to the right of the trigger
            const distToRightEdge = window.innerWidth - rect.left;

            // Default to top (above), unless low on space
            let v: 'top' | 'bottom' = topSpace > 180 ? 'top' : 'bottom';
            // If strictly better below:
            if (v === 'top' && topSpace < 180 && bottomSpace > 180) v = 'bottom';

            // Default to left-aligned, unless close to right edge
            // Card width approx 250px
            let h: 'left' | 'right' = distToRightEdge > 260 ? 'left' : 'right';

            setPos({ vertical: v, horizontal: h });
        }
        setHovering(true);
    };

    return (
        <span
            ref={triggerRef}
            className="relative inline-block text-blue-600 font-medium cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHovering(false)}
        >
            @{name}
            {hovering && (
                <div
                    className={`absolute z-50 ${pos.vertical === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} ${pos.horizontal === 'left' ? 'left-0' : 'right-0'}`}
                >
                    <UserHoverCard user={userData} />
                </div>
            )}
        </span>
    );
};
