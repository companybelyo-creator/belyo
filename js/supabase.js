// ============================================================
// CONFIGURATION SUPABASE
// Remplace ces valeurs par celles de ton projet Supabase :
// Dashboard Supabase → Settings → API
// ============================================================

const SUPABASE_URL = 'https://vshhswrzyntpkjoggamw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaGhzd3J6eW50cGtqb2dnYW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1NzgsImV4cCI6MjA5MDM2MzU3OH0.iD9xSKZSh2nuFFScMtfcUNtK9M4gfDrJi2Jp-_1A-Go';

// Initialisation du client Supabase (via CDN, chargé avant ce script)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);