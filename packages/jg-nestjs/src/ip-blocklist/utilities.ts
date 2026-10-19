import { IPV4_MAPPED_PATTERN } from './constants.js';

/**
 * Normalizes an IP address the way IpBlocklistGuard checks it: trimmed, lowercased, and an IPv4
 * address mapped into IPv6, as `::ffff:203.0.113.7`, as plain IPv4. Normalize addresses the same
 * way before adding them to the blocklist.
 * @param ip The address.
 * @returns The normalized address.
 * @example
 * import { normalizeIp } from 'jg-nestjs';
 *
 * normalizeIp(' ::FFFF:203.0.113.7 '); // '203.0.113.7'
 * normalizeIp('2001:DB8::1'); // '2001:db8::1'
 */
export const normalizeIp = (ip: string): string => {
  const lowered = ip.trim().toLowerCase();
  return IPV4_MAPPED_PATTERN.exec(lowered)?.[1] ?? lowered;
};
