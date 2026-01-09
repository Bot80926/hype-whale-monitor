
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("simulated_positions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entry_price, direction, amount_usd, leverage, trigger_id, end_time } = body;

    if (!entry_price || !direction) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("simulated_positions")
      .upsert([
        {
          entry_price,
          direction,
          amount_usd: amount_usd || 1000,
          leverage: leverage || 5,
          status: "OPEN",
          trigger_id: trigger_id || null, // Optional for manual trades if any
          end_time: end_time || null,
        },
      ], { onConflict: "trigger_id", ignoreDuplicates: true })
      .select()
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 is single record not found, happens if ignored

    return NextResponse.json(data || { message: "Conflict or duplicate trigger_id ignored" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, close_price, pnl_percent } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("simulated_positions")
      .update({ status, close_price, pnl_percent })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
