// Supabase-backed Shopify session storage. Implements the SessionStorage
// interface that shopify-app-remix expects. Persists OAuth tokens so they
// survive Railway's ephemeral containers.
import { Session } from "@shopify/shopify-api";
import { supabase } from "../db.server.js";

const TABLE = "shopify_sessions";

function rowToSession(row) {
  const obj = { ...row.data };
  if (obj.expires) obj.expires = new Date(obj.expires); // Session expects a Date
  return new Session(obj);
}

export class SupabaseSessionStorage {
  async storeSession(session) {
    const row = {
      id: session.id,
      shop: session.shop,
      state: session.state ?? null,
      is_online: !!session.isOnline,
      scope: session.scope ?? null,
      expires: session.expires ? new Date(session.expires).toISOString() : null,
      access_token: session.accessToken ?? null,
      data: session.toObject(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "id" });
    if (error) throw new Error(`storeSession: ${error.message}`);
    return true;
  }

  async loadSession(id) {
    const { data, error } = await supabase.from(TABLE).select("data").eq("id", id).maybeSingle();
    if (error) throw new Error(`loadSession: ${error.message}`);
    return data ? rowToSession(data) : undefined;
  }

  async deleteSession(id) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(`deleteSession: ${error.message}`);
    return true;
  }

  async deleteSessions(ids) {
    if (!ids?.length) return true;
    const { error } = await supabase.from(TABLE).delete().in("id", ids);
    if (error) throw new Error(`deleteSessions: ${error.message}`);
    return true;
  }

  async findSessionsByShop(shop) {
    const { data, error } = await supabase.from(TABLE).select("data").eq("shop", shop);
    if (error) throw new Error(`findSessionsByShop: ${error.message}`);
    return (data ?? []).map(rowToSession);
  }
}
