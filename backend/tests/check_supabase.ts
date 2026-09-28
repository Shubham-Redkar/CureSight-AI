import { createClient } from "@supabase/supabase-js";
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function main() {
  const { data, error } = await supabase.storage.from('wound-images').list('wounds');
  if (error) throw error;
  console.log('Originals found:', data.length);
  data.forEach(d => console.log('  ', d.name));
}

main().catch(console.error);
