import { getApiBaseUrl } from '../lib/config';

export default function Home() {
  const apiBaseUrl = getApiBaseUrl();
  
  return (
    <main>
      <h1>Global Food Delivery Platform</h1>
      <p>Customer experience foundation.</p>
      <p>API: {apiBaseUrl}</p>
    </main>
  );
}
