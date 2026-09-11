import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local or .env
let envContent = '';
const envLocalPath = path.resolve('.env.local');
const envPath = path.resolve('.env');

if (fs.existsSync(envLocalPath)) {
  envContent = fs.readFileSync(envLocalPath, 'utf8');
} else if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

const lines = envContent.split(/\r?\n/);
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...v] = trimmed.split('=');
  const val = v.join('=').trim().replace(/^["']|["']$/g, '');
  if (k.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
  if (k.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || k.trim() === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') supabaseKey = val;
}

console.log('--- SUPABASE CONNECTION TEST ---');
console.log('URL present:', Boolean(supabaseUrl), supabaseUrl ? `(${supabaseUrl})` : '(empty)');
console.log('Key present:', Boolean(supabaseKey), supabaseKey ? `(${supabaseKey.substring(0, 15)}...)` : '(empty)');

if (!supabaseUrl || !supabaseKey) {
  console.log('Result: MISSING_CONFIG. Please ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

try {
  const startTime = Date.now();
  const resp = await fetch(`${supabaseUrl}/rest/v1/departments?select=*`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const elapsed = Date.now() - startTime;

  if (!resp.ok) {
    const errorText = await resp.text();
    console.log(`Connection error (HTTP ${resp.status}):`, errorText);
    process.exit(1);
  }

  const data = await resp.json();
  console.log(`Connection SUCCESSFUL! (${elapsed}ms)`);
  console.log(`Status: HTTP ${resp.status}`);
  console.log(`Fetched ${data.length} department records from Supabase:`, data.map(d => d.name));

  console.log('Database tables connection verified successfully!');
  process.exit(0);
} catch (err) {
  console.log('Exception during connection:', err.message);
  process.exit(1);
}
