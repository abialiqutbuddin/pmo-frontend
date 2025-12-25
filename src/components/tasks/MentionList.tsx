import React from 'react';

interface User {
    id: string;
    fullName?: string;
    email?: string;
    profileImage?: string;
}

interface MentionListProps {
    users: User[];
    onSelect: (user: User) => void;
    selectedIndex: number;
}

export const MentionList: React.FC<MentionListProps> = ({ users, onSelect, selectedIndex }) => {
    if (users.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
            <div className="max-h-48 overflow-y-auto">
                {users.map((user, index) => (
                    <button
                        key={user.id}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors ${index === selectedIndex ? 'bg-blue-50' : ''
                            }`}
                        onClick={() => onSelect(user)}
                    >
                        {user.profileImage ? (
                            <img src={user.profileImage} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs shadow-sm">
                                {(user.fullName || user.email || '?')[0].toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{user.fullName || 'User'}</div>
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
