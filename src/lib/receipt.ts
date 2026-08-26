// Shared shape for receipt-scan results, used by both the /api/parse-receipt
// route and the Split "Scan receipt" UI.
export type ReceiptItem = {
  name: string;
  priceCents: number;
};

export type ParsedReceipt = {
  items: ReceiptItem[];
  totalCents: number;
};

// A realistic hawker-centre receipt for the "Try demo receipt" path — lets
// the scan flow be demoed reliably with no camera/upload and no live OCR call.
export const DEMO_RECEIPT: ParsedReceipt = {
  items: [
    { name: "Chicken Rice", priceCents: 450 },
    { name: "Char Kway Teow", priceCents: 500 },
    { name: "Teh Tarik", priceCents: 180 },
    { name: "Iced Milo", priceCents: 200 },
    { name: "Fried Carrot Cake", priceCents: 400 },
  ],
  totalCents: 1730,
};
