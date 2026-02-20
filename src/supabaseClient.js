const { createClient } = require('@supabase/supabase-js');
const { supabaseUrl, supabaseAnonKey } = require('./config');

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

module.exports = { supabase };

