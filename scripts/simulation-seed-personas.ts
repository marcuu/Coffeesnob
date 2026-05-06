import { loadDotEnv } from "./_env";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadPersonas, personaToFrozenYaml } from "../simulation/lib/persona-loader";

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const personas = loadPersonas();

  for (const persona of personas) {
    const email = `${persona.id}@synthetic.coffeesnob.local`;
    const { data: existing } = await sb
      .from("reviewers")
      .select("id")
      .eq("username", persona.handle.replace(/^@/, ""))
      .maybeSingle();

    let reviewerId = existing?.id as string | undefined;
    if (!reviewerId) {
      const created = await sb.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { synthetic: true },
      });
      if (created.error) throw created.error;
      reviewerId = created.data.user.id;
    }

    const { error } = await sb
      .from("reviewers")
      .update({
        display_name: persona.name,
        username: persona.handle.replace(/^@/, ""),
        bio: persona.bio,
        home_city: "Bramford",
        is_synthetic: true,
        persona_yaml: personaToFrozenYaml(persona),
        seen_onboarding_at: new Date().toISOString(),
      })
      .eq("id", reviewerId);
    if (error) throw error;

    await sb.from("agent_state").upsert({ reviewer_id: reviewerId }, { onConflict: "reviewer_id" });
  }

  console.log(JSON.stringify({ seeded: personas.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
