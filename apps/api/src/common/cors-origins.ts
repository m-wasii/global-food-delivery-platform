export function resolveCorsOrigins(env: {
  PUBLIC_WEB_URL?: string;
  PARTNER_WEB_URL?: string;
}): string[] {
  const origins = [
    env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
    env.PARTNER_WEB_URL ?? 'http://localhost:3002',
  ];
  return origins.filter((origin, index, all) => all.indexOf(origin) === index);
}
