'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/config';

interface Address {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
    latitude: string | number | null;
    longitude: string | number | null;
}

interface AddressListResponse {
    addresses: Address[];
    defaultAddressId: string | null;
}

/** Pure fetch — no setState, so mount effect and button refresh can share it. */
async function fetchAddressList(): Promise<AddressListResponse> {
    const res = await fetch(`${getApiBaseUrl()}/addresses`, {
        credentials: 'include',
    });
    if (!res.ok) {
        throw new Error(
            res.status === 401 ? 'Log in first' : 'Could not load addresses',
        );
    }
    return res.json();
}

export default function AddressesPage() {
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [defaultAddress, setDefaultAddress] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [line1, setLine1] = useState('');
    const [line2, setLine2] = useState('');
    const [city, setCity] = useState('');
    const [region, setRegion] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);

    async function load() {
        try {
            const data = await fetchAddressList();
            setAddresses(data.addresses);
            setDefaultAddress(data.defaultAddressId ?? null);
            setStatus('ready');
        } catch (error) {
            setStatus('error');
            setMessage(
                error instanceof Error ? error.message : 'Could not load addresses',
            );
        }
    }

    useEffect(() => {
        async function loadOnMount() {
            try {
                const data = await fetchAddressList();
                setAddresses(data.addresses);
                setDefaultAddress(data.defaultAddressId ?? null);
                setStatus('ready');
            } catch (error) {
                setStatus('error');
                setMessage(
                    error instanceof Error ? error.message : 'Could not load addresses',
                );
            }
        }
        void loadOnMount();
    }, []);

    function startEdit(address: Address) {
        setEditingId(address.id);
        setLabel(address.label ?? '');
        setLine1(address.line1);
        setLine2(address.line2 ?? '');
        setCity(address.city);
        setRegion(address.region ?? '');
        setPostalCode(address.postalCode ?? '');
        setCountry(address.country);
        setLatitude(address.latitude != null ? String(address.latitude) : '');
        setLongitude(address.longitude != null ? String(address.longitude) : '');
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setStatus('saving');
        setMessage('');

        const isEditing = editingId !== null;

        try {
            const res = await fetch(
                isEditing
                    ? `${getApiBaseUrl()}/addresses/${editingId}`
                    : `${getApiBaseUrl()}/addresses`,
                {
                    method: isEditing ? 'PATCH' : 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line1,
                        city,
                        country,
                        ...(label.trim() ? { label: label.trim() } : {}),
                        ...(line2.trim() ? { line2: line2.trim() } : {}),
                        ...(region.trim() ? { region: region.trim() } : {}),
                        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
                        ...(latitude.trim() ? { latitude: Number(latitude) } : {}),
                        ...(longitude.trim() ? { longitude: Number(longitude) } : {}),
                    }),
                },
            );
            if (!res.ok) {
                setStatus('error');
                setMessage('Could not save address');
                return;
            }
            clearForm();
            setMessage('Address saved');
            await load();
        } catch {
            setStatus('error');
            setMessage('Could not save address');
        }
    }

    async function deleteAddress(id: string) {
        try {
            const res = await fetch(`${getApiBaseUrl()}/addresses/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                setStatus('error');
                setMessage('Could not delete address');
                return;
            }
            setLastDeletedId(id);
            setMessage('Address deleted');
            await load();
        } catch {
            setStatus('error');
            setMessage('Could not delete address');
        }
    }

    async function undoDelete() {
        if (!lastDeletedId) return;
        try {
            const res = await fetch(
                `${getApiBaseUrl()}/addresses/${lastDeletedId}/restore`,
                {
                    method: 'POST',
                    credentials: 'include',
                },
            );
            if (!res.ok) {
                setStatus('error');
                setMessage('Could not undo delete');
                return;
            }
            setLastDeletedId(null);
            setMessage('Address restored');
            await load();
        } catch {
            setStatus('error');
            setMessage('Could not undo delete');
        }
    }

    async function setActive(id: string) {
        try {
            const res = await fetch(`${getApiBaseUrl()}/addresses/${id}/default`, {
                method: 'PATCH',
                credentials: 'include',
            });
            if (!res.ok) {
                setStatus('error');
                setMessage('Could not set active address');
                return;
            }
            setMessage('Address set as active');
            await load();
        } catch {
            setStatus('error');
            setMessage('Could not set active address');
        }
    }

    function clearForm() {
        setEditingId(null);
        setLabel('');
        setLine1('');
        setLine2('');
        setCity('');
        setRegion('');
        setPostalCode('');
        setCountry('');
        setLatitude('');
        setLongitude('');
    }

    if (status === 'loading') {
        return <main>Loading...</main>;
    }
    return (
        <main>
            <h1>Addresses</h1>
            <form onSubmit={onSubmit}>
                <label>Label</label>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
                <br />
                <label>Line 1</label>
                <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} />
                <br />
                <label>Line 2</label>
                <input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} />
                <br />
                <label>City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
                <br />
                <label>Region</label>
                <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
                <br />
                <label>Postal Code</label>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                <br />
                <label>Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
                <br />
                <label>Latitude</label>
                <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                />
                <br />
                <label>Longitude</label>
                <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                />
                <br />
                <button type="submit">
                    {editingId !== null ? 'Update' : 'Add'}
                </button>
                {editingId !== null ? (
                    <button type="button" onClick={clearForm}>
                        Cancel
                    </button>
                ) : null}
            </form>
            <ul>
                {addresses.map((address) => (
                    <li key={address.id}>
                        {address.label ?? address.line1}
                        {address.id === defaultAddress ? ' (Active)' : null}
                        {address.latitude == null || address.longitude == null
                            ? ' (no pin)'
                            : null}
                        <button type="button" onClick={() => setActive(address.id)}>
                            Set as active
                        </button>
                        <button type="button" onClick={() => startEdit(address)}>
                            Edit
                        </button>
                        <button type="button" onClick={() => deleteAddress(address.id)}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            {message ? <p>{message}</p> : null}
            {lastDeletedId ? (
                <p>
                    <button type="button" onClick={() => void undoDelete()}>
                        Undo delete
                    </button>
                </p>
            ) : null}
        </main>
    );
}
