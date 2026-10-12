import { describe, expect, it } from 'vitest';

import {
  directionsUrl,
  formatCustomerAddress,
  isMapLink,
  mapDestination,
  parseMapLocation,
  routeUrl,
} from '@/src/domain/customers/location';

const pin = { latitude: 18.5035, longitude: 73.8138, source: 'admin' as const, updatedAt: '2026-09-16T00:00:00.000Z' };

describe('customer address', () => {
  it('reads in delivery order without repeating itself', () => {
    expect(
      formatCustomerAddress({
        houseFlatNumber: 'B-204',
        societyName: 'Green View',
        streetArea: 'Karve Road',
        address: 'Green View',
        landmark: 'Petrol pump',
        city: 'Pune',
        pincode: '411038',
      }),
    ).toBe('B-204, Green View, Karve Road, Near Petrol pump, Pune 411038');
  });

  it('does not say "Near" twice when the landmark already starts with it', () => {
    expect(formatCustomerAddress({ societyName: 'Mahalaxmi Heights', landmark: 'Near City Pride', city: 'Pune' })).toBe(
      'Mahalaxmi Heights, Near City Pride, Pune',
    );
  });

  it('does not repeat an older one-line address that already holds the flat and society', () => {
    expect(
      formatCustomerAddress({ houseFlatNumber: 'Block B-402', societyName: 'Shiv Residency', address: 'Block B-402, Shiv Residency, Ward 3' }),
    ).toBe('Block B-402, Shiv Residency, Ward 3');
  });

  it('does not repeat the city and pincode already written in the address line', () => {
    expect(
      formatCustomerAddress({ societyName: 'Shiv Residency', address: 'Shiv Residency, Kothrud, Pune, 411038', city: 'Pune', pincode: '411038' }),
    ).toBe('Shiv Residency, Kothrud, Pune, 411038');
    expect(formatCustomerAddress({ address: 'Kothrud, Pune', city: 'Pune', pincode: '411038' })).toBe('Kothrud, Pune, 411038');
  });
});

describe('reading a pasted location', () => {
  it('accepts plain coordinates and every long Google Maps link shape', () => {
    expect(parseMapLocation('18.5035, 73.8138')).toEqual({ latitude: 18.5035, longitude: 73.8138 });
    expect(parseMapLocation('https://www.google.com/maps/@18.5035,73.8138,17z')).toEqual({ latitude: 18.5035, longitude: 73.8138 });
    expect(parseMapLocation('https://maps.google.com/?q=18.5035,73.8138')).toEqual({ latitude: 18.5035, longitude: 73.8138 });
    expect(
      parseMapLocation('https://www.google.com/maps/place/Amrale+Dairy/@18.50,73.81,17z/data=!3m1!4b1!4m6!3m5!3d18.5035!4d73.8138'),
    ).toEqual({ latitude: 18.5035, longitude: 73.8138 });
  });

  it('refuses nonsense and keeps short share links as links', () => {
    expect(parseMapLocation('somewhere in Pune')).toBeNull();
    expect(parseMapLocation('200, 73')).toBeNull();
    expect(parseMapLocation('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(isMapLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true);
    expect(isMapLink('https://example.com/map')).toBe(false);
  });
});

describe('directions from the current location', () => {
  it('head for the pin when there is one, otherwise the written address', () => {
    expect(mapDestination({ geoLocation: pin, address: 'ignored' })).toBe('18.5035,73.8138');
    expect(mapDestination({ mapLink: 'https://maps.google.com/?q=18.1,73.2' })).toBe('18.1,73.2');
    expect(mapDestination({ societyName: 'Green View', city: 'Pune' })).toBe('Green View, Pune');
  });

  it('leave out the start point so Google Maps starts where the phone is', () => {
    const url = directionsUrl({ geoLocation: pin })!;
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=18.5035%2C73.8138&travelmode=driving');
    expect(url).not.toContain('origin=');
  });

  it('fall back to a short share link, and to nothing when nothing is known', () => {
    expect(directionsUrl({ mapLink: 'https://maps.app.goo.gl/AbCdEf123' })).toBe('https://maps.app.goo.gl/AbCdEf123');
    expect(directionsUrl({})).toBeNull();
  });

  it('route through several stops, the last one as the destination, at most ten', () => {
    const stops = Array.from({ length: 12 }, (_, i) => ({ geoLocation: { ...pin, latitude: 18 + i / 100 } }));
    const route = routeUrl(stops)!;
    expect(route.stops).toBe(10);
    const params = new URL(route.url).searchParams;
    expect(params.get('destination')).toBe('18.09,73.8138');
    expect(params.get('waypoints')!.split('|')).toHaveLength(9);
    expect(routeUrl([{}])).toBeNull();
  });
});
