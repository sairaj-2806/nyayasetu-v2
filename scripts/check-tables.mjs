import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = fs.readFileSync(".env", "utf8");
for (const l of env.split("\n")) {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
}

function createSupabaseFetch(key) {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
      headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  global: { fetch: createSupabaseFetch(process.env.SUPABASE_SERVICE_ROLE_KEY) },
});

async function check() {
  const { data: at, error: e1 } = await sb.from("asset_transfers").select("*").limit(1);
  console.log("asset_transfers:", at?.length, e1?.message);
  const { data: ec, error: e2 } = await sb.from("evidence_chain_of_custody").select("*").limit(1);
  console.log("evidence_chain_of_custody:", ec?.length, e2?.message);
  const { data: pa, error: e3 } = await sb.from("police_assets").select("*").limit(1);
  console.log("police_assets:", pa?.length, e3?.message);
  const { data: al, error: e4 } = await sb.from("audit_logs").select("*").limit(1);
  console.log("audit_logs:", al?.length, e4?.message);
}

check();
