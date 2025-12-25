// frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Navigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { Dropdown } from '../components/ui/Dropdown';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const lookupTenants = useAuthStore((s) => s.lookupTenants);
  const isAuthed = !!useAuthStore((s) => s.accessToken);

  // Steps: 'email' -> 'org' -> 'password' (or just email -> org -> password combined?)
  // Let's do: Email -> (Next) -> Lookup -> If multiple, show Org Dropdown -> (Next) -> Password -> Login
  const [step, setStep] = useState<'email' | 'org' | 'password'>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (step === 'email') {
        const list = await lookupTenants(email);
        if (list.length === 0) {
          setError('No account found for this email.');
        } else if (list.length === 1) {
          setTenants(list);
          setTenantId(list[0].id); // or list[0].slug
          setStep('password');
        } else {
          setTenants(list);
          setTenantId(list[0].id);
          setStep('org');
        }
      } else if (step === 'org') {
        setStep('password');
      } else if (step === 'password') {
        // Find the slug or ID to send
        const t = tenants.find(x => x.id === tenantId);
        // We pass the slug ideally, or ID. The backend middleware accepts both.
        // Let's pass the slug if available for readability, or ID.
        const headerVal = t ? t.slug : tenantId;
        await login(email, password, headerVal);
        navigate('/events', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthed) return <Navigate to="/events" replace />;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
            PMO
          </div>
          <h1 className="text-xl font-semibold">
            {step === 'password' ? 'Enter Password' : 'Sign in'}
          </h1>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={onNext} className="space-y-4">
          {step === 'email' && (
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          )}

          {step === 'org' && (
            <div>
              <label className="block text-sm mb-1">Select Organization</label>
              <div className="space-y-2">
                {tenants.map(t => (
                  <label key={t.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${tenantId === t.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="tenant"
                      value={t.id}
                      checked={tenantId === t.id}
                      onChange={() => setTenantId(t.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.slug}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{email}</div>
                  <div className="text-xs text-gray-500">
                    {tenants.find(t => t.id === tenantId)?.name || tenantId}
                  </div>
                </div>
                <button type="button" onClick={() => { setStep('email'); setPassword(''); }} className="text-xs text-blue-600 hover:underline">Change</button>
              </div>

              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 font-medium transition flex items-center justify-center"
          >
            {submitting && <Spinner size="sm" className="mr-2 text-white" />}
            {step === 'email' ? 'Next' : step === 'org' ? 'Next' : 'Sign in'}
          </button>

          {step === 'email' && (
            <div className="text-center mt-4">
              <button type="button" onClick={() => { setStep('password'); setTenants([]); setTenantId('system'); }} className="text-xs text-gray-400 hover:text-gray-600">
                Skip lookup (Manual System Login)
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
