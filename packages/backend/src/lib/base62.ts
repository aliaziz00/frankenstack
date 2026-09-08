const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = BigInt(ALPHABET.length);

// Encodes a positive integer (the DB row's serial id) into a short,
// URL-safe string. This is the "ID generation" piece of a URL shortener
// system design: encoding a counter is simple and collision-free by
// construction, at the cost of codes being sequential/guessable and the
// scheme needing rework if writes ever get sharded across DBs (each shard
// would mint overlapping ids). The alternative -- generate a random string
// and retry on collision -- trades that predictability for occasional
// wasted round-trips.
export function toBase62(n: bigint | number): string {
  let value = typeof n === "number" ? BigInt(n) : n;
  if (value < 0n) throw new RangeError("toBase62: expected a non-negative integer");
  if (value === 0n) return ALPHABET[0];

  let out = "";
  while (value > 0n) {
    const remainder = value % BASE;
    out = ALPHABET[Number(remainder)] + out;
    value /= BASE;
  }
  return out;
}
