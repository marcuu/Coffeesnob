// One-off script: create auth users + reviewer rows from persona YAML files.
// Run with: npm run simulation:seed-personas
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
//
// Safe to re-run: uses email-based upsert logic so existing personas are
// updated rather than duplicated.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";
import { loadAllPersonas, type Persona } from "../lib/persona-loader";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

const PERSONAS_DIR = join(__dirname, "../personas");
const EMAIL_DOMAIN = "bramford.internal.coffeesnob.app";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const sb: Sb = createClient(url, key, { auth: { persistSession: false } });
  const personas = loadAllPersonas(PERSONAS_DIR);
  console.log(`Seeding ${personas.length} personas…`);

  for (const persona of personas) {
    await seedPersona(sb, persona);
  }

  console.log("Done.");
}

async function seedPersona(sb: Sb, persona: Persona) {
  const email = `${persona.id}@${EMAIL_DOMAIN}`;
  console.log(`  → ${persona.name} (${email})`);

  // 1. Look up existing auth user by email.
  const { data: listData } = await (sb.auth.admin as any).listUsers();
  const existing = (listData?.users ?? []).find((u: { email?: string }) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`    existing user ${userId}`);
  } else {
    // 2. Create auth user. The handle_new_auth_user trigger auto-creates the
    //    reviewers row. We use a random password — persona never logs in.
    const { data, error } = await (sb.auth.admin as any).createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { is_synthetic: true },
    });
    if (error) throw new Error(`createUser failed for ${persona.id}: ${error.message}`);
    userId = data.user.id;
    console.log(`    created user ${userId}`);
  }

  // 3. Ensure email is in allowed_users so RLS select policies work.
  await sb.from("allowed_users").upsert({ email }, { onConflict: "email" });

  // 4. Update reviewers row with persona metadata.
  const { error: revErr } = await sb
    .from("reviewers")
    .update({
      is_synthetic: true,
      persona_yaml: JSON.stringify(persona), // stored as JSON for fast parsing
      display_name: persona.name,
      bio: persona.bio.trim(),
      home_city: persona.city,
      status: "active",
    })
    .eq("id", userId);
  if (revErr) throw new Error(`reviewers update failed for ${persona.id}: ${revErr.message}`);

  // 5. Ensure agent_state row exists.
  await sb
    .from("agent_state")
    .upsert({ reviewer_id: userId }, { onConflict: "reviewer_id", ignoreDuplicates: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
