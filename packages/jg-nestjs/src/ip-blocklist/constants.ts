// the token IpBlocklistGuard reads its options from, provided with `useValue` or `useFactory`
export const IP_BLOCKLIST_GUARD_OPTIONS = Symbol('IP_BLOCKLIST_GUARD_OPTIONS');

// an IPv4 address mapped into IPv6, as a dual-stack server reports an IPv4 client
export const IPV4_MAPPED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;
