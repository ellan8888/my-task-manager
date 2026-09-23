// hash-password.js
const bcrypt = require('bcryptjs');

const USERS = [
  { username: 'ellan', password: '88888888', display_name: 'Ellan', role: 'superadmin' },
  { username: 'ridho', password: '88888888', display_name: 'Ridho', role: 'user' },
  { username: 'rizki', password: '88888888', display_name: 'Rizki', role: 'user' },
];

(async () => {
  console.log('-- Copy paste ini ke Supabase SQL Editor:\n');
  
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    console.log(
      `INSERT INTO users (username, password_hash, display_name, role) ` +
      `VALUES ('${u.username}', '${hash}', '${u.display_name}', '${u.role}') ` +
      `ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, ` +
      `display_name = EXCLUDED.display_name, role = EXCLUDED.role;`
    );
  }
})();