let cached;

// Keep the dispatch address private: only coordinates go to the routing service.
export async function providerCoordinates(fetcher = fetch) {
  const address = process.env.PROVIDER_ADDRESS?.trim() || '52 Ross Road, Cullinan, South Africa';
  const lat = process.env.PROVIDER_LAT?.trim();
  const lng = process.env.PROVIDER_LNG?.trim();
  if (lat || lng) {
    if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) throw Error('Invalid provider coordinates. Configure both latitude and longitude.');
    return [Number(lng), Number(lat)];
  }
  const key = process.env.ORS_API_KEY?.trim();
  if (!key) throw Error('Provider address lookup requires the routing API key.');
  if (cached?.address === address && cached.key === key && cached.expires > Date.now()) return cached.coordinates;
  const url = new URL('https://api.openrouteservice.org/geocode/search');
  url.search = new URLSearchParams({ text: address, 'boundary.country': 'ZA', size: '1' }).toString();
  const response = await fetcher(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Provider address lookup unavailable.');
  const feature = (await response.json()).features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  const houseNumber = address.match(/^\d+[a-z]?\b/i)?.[0];
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90 || !houseNumber || String(feature?.properties?.housenumber).toLowerCase() !== houseNumber.toLowerCase()) {
    throw Error('The provider street number could not be located. Set verified PROVIDER_LAT and PROVIDER_LNG.');
  }
  cached = { address, key, coordinates, expires: Date.now() + 86400000 };
  return coordinates;
}
