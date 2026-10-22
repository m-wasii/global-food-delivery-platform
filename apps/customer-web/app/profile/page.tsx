'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/config';

export default function ProfilePage() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`${getApiBaseUrl()}/users/me`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    setStatus('error');
                    setMessage(res.status === 401 ? 'Log in first' : 'Could not load profile');
                    return;
                }
                const data = await res.json();
                setEmail(data.user.email);
                setName(data.user.name);
                setStatus('ready');
            } catch {
                setStatus('error');
                setMessage('Could not load profile');
            }
        }
        void load();
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setStatus('saving');
        setMessage('');
        try {
            const res = await fetch(`${getApiBaseUrl()}/users/me`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                setStatus('error');
                setMessage('Could not save profile');
                return;
            }
            const data = await res.json();
            setName(data.user.name);
            setStatus('ready');
            setMessage('Profile saved');
        } catch {
            setStatus('error');
            setMessage('Could not save profile');
        }
    }

    if (status === 'loading') {
        return <main><p>Loading...</p></main>;
    }

    return (
        <main>
            <h1>Profile</h1>
            <p>Email: {email}</p>
            <form onSubmit={onSubmit}>
                <label>
                    Name
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={status === 'saving'}
                    />
                </label>
                <button type="submit" disabled={status === 'saving'}>
                    Save
                </button>
            </form>
            {message ? <p>{message}</p> : null}
        </main>
    );
}