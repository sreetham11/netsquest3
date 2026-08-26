import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedReceipt } from "@/lib/receipt";

// Receipt-scan for Split's "Scan receipt" flow. Never leaves the user stuck:
// every failure path returns a clear message so the UI can fall back to
// manual entry.

const MAX_BYTES = 10 * 1024 * 1024;
type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED_TYPES = new Set<MediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_receipt",
  description: "Record the itemized line items and total amount read from a photo of a receipt.",
  input_schema: {
    type: "object",
    properties: {
      isReceipt: {
        type: "boolean",
        description: "false if the image is not a legible receipt/bill",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Item name as printed on the receipt" },
            price: { type: "number", description: "Item price in dollars, e.g. 4.5" },
          },
          required: ["name", "price"],
        },
      },
      total: { type: "number", description: "The receipt's total amount in dollars" },
    },
    required: ["isReceipt", "items", "total"],
  },
};

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("Receipt scanning isn't set up yet. Enter the split manually instead.", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Couldn't read the uploaded image.", 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File)) return fail("No image was provided.", 400);
  if (file.size === 0 || file.size > MAX_BYTES) {
    return fail("That image is too large or empty. Try a smaller photo.", 400);
  }
  const mediaType: MediaType = ALLOWED_TYPES.has(file.type as MediaType)
    ? (file.type as MediaType)
    : "image/jpeg";

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_receipt" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            {
              type: "text",
              text: "This is a photo of a receipt or bill. Call extract_receipt with every purchased line item (name + price) and the receipt's total amount. Don't list subtotal, tax, or service charge as items — those are folded into the total. If the image isn't a legible receipt, set isReceipt to false.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("parse-receipt: Anthropic call failed", err);
    return fail("Something went wrong reading that receipt. Try again or enter it manually.", 502);
  }

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return fail("Couldn't read that receipt. Try a clearer photo or enter it manually.", 422);
  }

  const input = toolUse.input as {
    isReceipt?: unknown;
    items?: Array<{ name?: unknown; price?: unknown }>;
    total?: unknown;
  };

  if (input.isReceipt === false) {
    return fail("That doesn't look like a receipt. Try another photo or enter it manually.", 422);
  }

  const items = (Array.isArray(input.items) ? input.items : [])
    .map((it) => ({
      name: String(it?.name ?? "").trim(),
      priceCents: Math.round(Number(it?.price) * 100),
    }))
    .filter((it) => it.name && Number.isFinite(it.priceCents) && it.priceCents >= 0);

  const totalCents = Math.round(Number(input.total) * 100);

  if (items.length === 0 || !Number.isFinite(totalCents) || totalCents <= 0) {
    return fail(
      "Couldn't make out the items on that receipt. Try a clearer photo or enter it manually.",
      422,
    );
  }

  const result: ParsedReceipt = { items, totalCents };
  return NextResponse.json(result);
}
