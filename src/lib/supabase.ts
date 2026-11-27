import { createClient } from '@supabase/supabase-js';

// Values come from .env.local (see .env.example). NEXT_PUBLIC_ values are bundled into the browser,
// so only the anon key belongs here and Row Level Security must protect the table.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
