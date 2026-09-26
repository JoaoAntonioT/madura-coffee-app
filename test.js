const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
supabase.from('team').insert([{ name: 'Test', pin: '999', role: 'ADMIN' }]).then(res => console.log('Team:', res)).catch(console.error);
supabase.from('inventory').insert([{ name: 'TestIngred', quantity: 1, unit: 'g' }]).then(res => console.log('Inv:', res)).catch(console.error);
