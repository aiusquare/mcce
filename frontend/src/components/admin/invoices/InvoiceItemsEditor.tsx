import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { InvoiceItem } from "./InvoiceTypes";

type DraftInvoiceItem = {
  description: string;
  amount: string;
};

type InvoiceItemsEditorProps = {
  items: DraftInvoiceItem[];
  onChange: (items: DraftInvoiceItem[]) => void;
  total: number;
  formatCurrency: (amount: number) => string;
};

export function toDraftItems(items?: InvoiceItem[]): DraftInvoiceItem[] {
  if (!items || items.length === 0) {
    return [{ description: "", amount: "" }];
  }

  return items.map((item) => ({
    description: item.description,
    amount: String(item.amount || ""),
  }));
}

export function normalizeDraftItems(items: DraftInvoiceItem[]): InvoiceItem[] {
  return items
    .map((item) => ({
      description: item.description.trim(),
      amount: Number(item.amount),
    }))
    .filter((item) => item.description && Number.isFinite(item.amount) && item.amount > 0);
}

export function getDraftItemsTotal(items: DraftInvoiceItem[]) {
  return normalizeDraftItems(items).reduce((total, item) => total + item.amount, 0);
}

export function InvoiceItemsEditor({
  items,
  onChange,
  total,
  formatCurrency,
}: InvoiceItemsEditorProps) {
  const updateItem = (
    index: number,
    field: keyof DraftInvoiceItem,
    value: string,
  ) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextItems.length ? nextItems : [{ description: "", amount: "" }]);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label>Invoice Items *</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { description: "", amount: "" }])}
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_140px_32px]"
          >
            <Input
              placeholder="Item description"
              value={item.description}
              onChange={(event) =>
                updateItem(index, "description", event.target.value)
              }
            />
            <Input
              type="number"
              min="0"
              placeholder="Amount"
              value={item.amount}
              onChange={(event) => updateItem(index, "amount", event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
