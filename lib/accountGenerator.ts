// lib/accountGenerator.ts — generator username & password akun Roblox (di browser)
//
// Aturan username Roblox: 3–20 karakter, huruf/angka/underscore,
// tidak boleh diawali/diakhiri underscore. Di sini cukup huruf + angka.
// Password Roblox: minimal 8 karakter dan tidak boleh mengandung username.

const ADJECTIVES = [
  "Sunny", "Lucky", "Swift", "Brave", "Calm", "Clever", "Cozy", "Crisp", "Daring", "Eager",
  "Fancy", "Fluffy", "Frosty", "Gentle", "Golden", "Happy", "Jolly", "Kind", "Lively", "Mellow",
  "Mighty", "Misty", "Noble", "Peppy", "Plucky", "Quick", "Quiet", "Rapid", "Rosy", "Rusty",
  "Shiny", "Silent", "Silver", "Sleepy", "Snowy", "Sparky", "Spicy", "Stormy", "Sweet", "Tiny",
  "Vivid", "Wild", "Witty", "Zesty", "Cosmic", "Pixel", "Neon", "Lunar", "Solar", "Turbo",
];

const NOUNS = [
  "Panda", "Tiger", "Falcon", "Otter", "Fox", "Wolf", "Koala", "Badger", "Raven", "Lynx",
  "Dragon", "Comet", "Rocket", "Ninja", "Pirate", "Knight", "Wizard", "Golem", "Phoenix", "Shark",
  "Bunny", "Kitten", "Puppy", "Hawk", "Owl", "Moose", "Bison", "Gecko", "Cobra", "Viper",
  "Maple", "Cedar", "River", "Storm", "Ember", "Frost", "Blaze", "Pebble", "Cloud", "Breeze",
  "Mango", "Cookie", "Muffin", "Waffle", "Noodle", "Taco", "Donut", "Pickle", "Bean", "Berry",
];

// Tanpa karakter yang mudah tertukar: O/0, I/l/1
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";

/** Angka acak 0..max-1 pakai crypto (bukan Math.random) */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max; // buang bias modulo
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

const pick = <T,>(list: readonly T[] | string): T =>
  (typeof list === "string" ? list[randomInt(list.length)] : list[randomInt(list.length)]) as T;

/** Contoh: SunnyPanda4821 (maksimal 20 karakter) */
export function generateUsername(): string {
  for (;;) {
    const digitCount = 2 + randomInt(3); // 2–4 angka
    let digits = String(1 + randomInt(9)); // angka pertama bukan 0
    for (let i = 1; i < digitCount; i++) digits += String(randomInt(10));
    const name = `${pick<string>(ADJECTIVES)}${pick<string>(NOUNS)}${digits}`;
    if (name.length >= 3 && name.length <= 20) return name;
  }
}

/** 12 karakter: minimal 1 huruf besar, 1 huruf kecil, 1 angka; tidak mengandung username */
export function generatePassword(username = "", length = 12): string {
  const all = UPPER + LOWER + DIGITS;
  for (;;) {
    const chars = [pick<string>(UPPER), pick<string>(LOWER), pick<string>(DIGITS)];
    while (chars.length < length) chars.push(pick<string>(all));
    // acak urutan (Fisher–Yates)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const pwd = chars.join("");
    if (!username || !pwd.toLowerCase().includes(username.toLowerCase())) return pwd;
  }
}
