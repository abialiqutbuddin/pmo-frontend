import React from 'react';

interface UserHoverProps {
    user: {
        id: string;
        fullName: string;
        email?: string;
        profileImage?: string;
        role?: string;
    };
}

export const UserHoverCard: React.FC<UserHoverProps> = ({ user }) => {
    return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 min-w-[200px] flex items-center gap-3 z-50">
            {user.profileImage ? (
                <img src={user.profileImage} className="w-10 h-10 rounded-full object-cover" alt="" />
            ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {user.fullName?.[0] || '?'}
                </div>
            )}
            <div className="overflow-hidden">
                <div className="font-semibold text-gray-900 truncate" title={user.fullName}>{user.fullName}</div>
                {user.email && <div className="text-xs text-gray-500 truncate" title={user.email}>{user.email}</div>}
                {user.role && <div className="text-[10px] text-gray-400 mt-0.5 uppercase">{user.role}</div>}
            </div>
        </div>
    );
};
