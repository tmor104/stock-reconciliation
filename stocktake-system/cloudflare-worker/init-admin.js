#!/usr/bin/env node

/**
 * Helper script to generate admin user hash for Cloudflare KV
 * 
 * Usage:
 *   node init-admin.js <password>
 * 
 * Then use the output command to add the user to KV
 */

import crypto from 'crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node init-admin.js <password>');
  console.error('Example: node init-admin.js mySecurePassword123');
  process.exit(1);
}

// Hash password using SHA-256 (same as frontend)
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

const hash = hashPassword(password);

const user = {
  username: 'admin',
  password: hash,
  role: 'admin'
};

console.log('\n✅ Admin user data generated!\n');
console.log('Add this to Cloudflare KV using one of these methods:\n');

console.log('Method 1: Using Wrangler CLI');
console.log('─'.repeat(60));
console.log(`wrangler kv:key put "users" '${JSON.stringify([user])}' --binding=STOCKTAKE_KV\n`);

console.log('Method 2: Using Cloudflare Dashboard');
console.log('─'.repeat(60));
console.log('1. Go to: https://dash.cloudflare.com');
console.log('2. Workers & Pages → KV');
console.log('3. Click your STOCKTAKE_KV namespace');
console.log('4. Click "Add entry"');
console.log('5. Key: users');
console.log('6. Value:');
console.log(JSON.stringify([user], null, 2));
console.log('\n');

console.log('After adding to KV, you can login with:');
console.log(`  Username: admin`);
console.log(`  Password: ${password}\n`);

