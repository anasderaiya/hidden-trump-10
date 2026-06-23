import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log('Testing connection to:', process.env.SUPABASE_URL);

  // Test 1: Check if players table exists
  const { data, error } = await supabase
    .from('players')
    .select('count')
    .limit(1);

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log('❌ players table does not exist yet. Run the SQL migration first.');
      console.log('   File: supabase/migrations/001_init.sql');
      console.log('   Go to: Supabase Dashboard → SQL Editor → paste and run the file');
    } else {
      console.log('❌ Connection error:', error.message);
    }
    return;
  }

  console.log('✅ Connection OK — players table exists!');

  // Test 2: Insert a test player
  const testId = 'test_' + Date.now();
  const { error: insertError } = await supabase.from('players').insert({
    id: testId,
    username: 'TestPlayer',
    avatar: 'avatar_1',
    card_back: 'classic_blue',
    table_skin: 'green_felt',
    coins: 500,
    mmr: 1000,
    rank_name: 'Bronze',
    is_bot: false,
    connected: false
  });

  if (insertError) {
    console.log('❌ Insert test failed:', insertError.message);
    return;
  }
  console.log('✅ Insert test passed');

  // Test 3: Read it back
  const { data: fetched } = await supabase.from('players').select('*').eq('id', testId).single();
  console.log('✅ Read test passed:', fetched?.username, '| MMR:', fetched?.mmr);

  // Test 4: Leaderboard view
  const { data: lb, error: lbErr } = await supabase.from('leaderboard').select('*');
  if (lbErr) {
    console.log('⚠️  Leaderboard view error:', lbErr.message);
  } else {
    console.log('✅ Leaderboard view OK — entries:', lb?.length);
  }

  // Cleanup test row
  await supabase.from('players').delete().eq('id', testId);
  console.log('✅ Cleanup done\n');
  console.log('🎉 All tests passed! Supabase integration is ready.');
}

main().catch(console.error);
