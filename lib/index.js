/**
 * Host half of the Whale-chan pet.
 *
 * All behavior is client-side: the pet watches the Session event stream and
 * draws itself into the frame-wide `shell.overlay` slot. The host row only
 * makes the package discoverable by the client module system.
 */
export const name = 'whale-chan-pet';
export const inject = [];

/** No host-side services are needed. */
export function apply() {}
