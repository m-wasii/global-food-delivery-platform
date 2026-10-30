'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../lib/config';

interface OperatingCity {
  id: string;
  name: string;
  country: string;
  slug: string;
}

interface DiscoveredRestaurant {
  id: string;
  name: string;
  slug: string;
  branch: {
    id: string;
    name: string;
    distanceKm: number;
    deliveryRadiusKm: number;
    operatingCity: { id: string; name: string; slug: string; country: string };
  };
}

interface Address {
  id: string;
  label: string | null;
  line1: string;
  latitude: string | number | null;
  longitude: string | number | null;
}

interface SearchResult {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    cuisineTags: string[];
  };
  matchReasons: Array<'name' | 'cuisine' | 'menu_item'>;
  matchedItems: Array<{
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  }>;
}

export default function Home() {
  const [cities, setCities] = useState<OperatingCity[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  const [operatingCityId, setOperatingCityId] = useState('');
  const [addressId, setAddressId] = useState('');
  const [latitude, setLatitude] = useState('31.5204');
  const [longitude, setLongitude] = useState('74.3587');
  const [restaurants, setRestaurants] = useState<DiscoveredRestaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function bootstrap() {
      try {
        const citiesRes = await fetch(`${getApiBaseUrl()}/operating-cities`);
        if (citiesRes.ok) {
          const data = (await citiesRes.json()) as OperatingCity[];
          setCities(data);
          if (data[0]) setOperatingCityId(data[0].id);
        }
      } catch {
        // Cities optional for bare lat/lng discovery.
      }

      try {
        const addrRes = await fetch(`${getApiBaseUrl()}/addresses`, {
          credentials: 'include',
        });
        if (addrRes.ok) {
          const data = (await addrRes.json()) as {
            addresses: Address[];
            defaultAddressId: string | null;
          };
          setAddresses(data.addresses);
          setDefaultAddressId(data.defaultAddressId);
          const preferred =
            data.addresses.find((a) => a.id === data.defaultAddressId) ??
            data.addresses[0];
          if (preferred) {
            setAddressId(preferred.id);
            if (preferred.latitude != null) setLatitude(String(preferred.latitude));
            if (preferred.longitude != null) setLongitude(String(preferred.longitude));
          }
        }
      } catch {
        // Guest discovery still works with manual coordinates.
      }
    }
    void bootstrap();
  }, []);

  async function runSearch(page = 1) {
    const q = searchQuery.trim();
    if (!q) {
      setMessage('Enter a search query');
      return;
    }
    setStatus('searching');
    setMessage('');
    const params = new URLSearchParams({
      q,
      page: String(page),
      pageSize: '10',
    });
    if (operatingCityId) params.set('operatingCityId', operatingCityId);

    try {
      const res = await fetch(`${getApiBaseUrl()}/discovery/search?${params}`);
      if (!res.ok) {
        setStatus('error');
        setMessage('Search failed');
        setSearchResults([]);
        return;
      }
      const data = (await res.json()) as {
        results: SearchResult[];
        page: number;
        totalPages: number;
        total: number;
      };
      setSearchResults(data.results);
      setSearchPage(data.page);
      setSearchTotalPages(data.totalPages);
      setStatus('ready');
      setMessage(
        data.total === 0 ? 'No restaurants matched that search.' : `${data.total} result(s)`,
      );
    } catch {
      setStatus('error');
      setMessage('Search failed');
      setSearchResults([]);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await runSearch(1);
  }

  async function onDiscover(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    const params = new URLSearchParams();
    if (operatingCityId) params.set('operatingCityId', operatingCityId);

    const selected = addresses.find((a) => a.id === addressId);
    if (selected?.latitude != null && selected?.longitude != null) {
      params.set('addressId', selected.id);
    } else {
      params.set('latitude', latitude);
      params.set('longitude', longitude);
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/discovery/restaurants?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setStatus('error');
        setMessage(body?.message ?? 'Could not discover restaurants');
        setRestaurants([]);
        return;
      }
      const data = (await res.json()) as { restaurants: DiscoveredRestaurant[] };
      setRestaurants(data.restaurants);
      setStatus('ready');
      setMessage(
        data.restaurants.length === 0
          ? 'No restaurants deliver to this location yet.'
          : '',
      );
    } catch {
      setStatus('error');
      setMessage('Could not discover restaurants');
      setRestaurants([]);
    }
  }

  return (
    <main>
      <h1>EatWave</h1>
      <p>Discover restaurants that deliver to your address.</p>
      <p>
        <Link href="/addresses">Addresses</Link>
        {' · '}
        <Link href="/orders">Orders</Link>
        {' · '}
        <Link href="/profile">Profile</Link>
      </p>

      <form onSubmit={onSearch}>
        <h2>Search</h2>
        <label htmlFor="q">Name, cuisine, or dish</label>
        <input
          id="q"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g. biryani"
          required
        />
        <button type="submit" disabled={status === 'searching'}>
          {status === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchResults.length > 0 ? (
        <section>
          <ul>
            {searchResults.map((result) => (
              <li key={result.restaurant.id}>
                <Link href={`/restaurants/${result.restaurant.slug}`}>
                  {result.restaurant.name}
                </Link>
                {result.restaurant.cuisineTags.length > 0
                  ? ` — ${result.restaurant.cuisineTags.join(', ')}`
                  : null}
                <div>Matched: {result.matchReasons.join(', ')}</div>
                {result.matchedItems.length > 0 ? (
                  <ul>
                    {result.matchedItems.map((item) => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {searchTotalPages > 1 ? (
            <p>
              <button
                type="button"
                disabled={searchPage <= 1 || status === 'searching'}
                onClick={() => void runSearch(searchPage - 1)}
              >
                Previous
              </button>{' '}
              Page {searchPage} / {searchTotalPages}{' '}
              <button
                type="button"
                disabled={searchPage >= searchTotalPages || status === 'searching'}
                onClick={() => void runSearch(searchPage + 1)}
              >
                Next
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      <form onSubmit={onDiscover}>
        <h2>Nearby</h2>
        {cities.length > 0 ? (
          <>
            <label htmlFor="city">Operating city</label>
            <select
              id="city"
              value={operatingCityId}
              onChange={(e) => setOperatingCityId(e.target.value)}
            >
              <option value="">Any</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.country})
                </option>
              ))}
            </select>
            <br />
          </>
        ) : null}

        {addresses.length > 0 ? (
          <>
            <label htmlFor="address">Delivery address</label>
            <select
              id="address"
              value={addressId}
              onChange={(e) => {
                setAddressId(e.target.value);
                const next = addresses.find((a) => a.id === e.target.value);
                if (next?.latitude != null) setLatitude(String(next.latitude));
                if (next?.longitude != null) setLongitude(String(next.longitude));
              }}
            >
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label ?? address.line1}
                  {address.id === defaultAddressId ? ' (active)' : ''}
                  {address.latitude == null ? ' — needs pin' : ''}
                </option>
              ))}
            </select>
            <br />
          </>
        ) : null}

        <label htmlFor="lat">Latitude</label>
        <input
          id="lat"
          type="number"
          step="any"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          required
        />
        <br />
        <label htmlFor="lng">Longitude</label>
        <input
          id="lng"
          type="number"
          step="any"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          required
        />
        <br />
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Find restaurants'}
        </button>
      </form>

      {message ? <p>{message}</p> : null}

      <ul>
        {restaurants.map((restaurant) => (
          <li key={restaurant.id}>
            <Link href={`/restaurants/${restaurant.slug}`}>
              {restaurant.name}
            </Link>
            {' — '}
            {restaurant.branch.name}, {restaurant.branch.distanceKm} km away
            {' ('}
            {restaurant.branch.operatingCity.name}
            {')'}
          </li>
        ))}
      </ul>
    </main>
  );
}
