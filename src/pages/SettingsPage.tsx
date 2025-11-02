import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium mb-3">Account</div>
        <button
          onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
          className="inline-flex items-center bg-rose-600 hover:bg-rose-700 text-white rounded-md px-3 py-2 text-sm"
        >
          <LogOut size={16} className="mr-2" /> Logout
        </button>
      </div>
    </div>
  );
};

