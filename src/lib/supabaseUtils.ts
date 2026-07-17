import { supabase } from "@/integrations/supabase/client";

export async function fetchAllMedicoes() {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("medicoes")
      .select("*")
      .order("data", { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < limit) hasMore = false;
      else from += limit;
    } else {
      hasMore = false;
    }
  }
  return { data: allData, error: null };
}

export async function fetchAllMedicoesTerceiros() {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("medicoes_terceiros")
      .select("*")
      .order("data", { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < limit) hasMore = false;
      else from += limit;
    } else {
      hasMore = false;
    }
  }
  return { data: allData, error: null };
}
