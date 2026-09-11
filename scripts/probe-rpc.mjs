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

async function probe() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  const data = await res.json();
  console.log("PostgREST OpenAPI definitions:", Object.keys(data.definitions || {}));
}

probe().catch(console.error);
