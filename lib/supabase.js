import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqhovlyhvxpploiqonej.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaG92bHlodnhwcGxvaXFvbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MTYzOTQsImV4cCI6MjA1MzM5MjM5NH0.WCYVyEXBHpN9bGkxU0Kr62XRfUurZSxqNb7VbWvqL7A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 