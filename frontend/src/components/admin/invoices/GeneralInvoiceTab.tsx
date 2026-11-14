import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { GeneralInvoice } from "./InvoiceTypes";
import {
  getDraftItemsTotal,
  InvoiceItemsEditor,
  normalizeDraftItems,
  toDraftItems,
} from "./InvoiceItemsEditor";
import {
  createFeeInvoice,
  deleteFeeInvoice,
  getFeeInvoices,
  publishFeeInvoice,
  updateFeeInvoice,
} from "@/lib/fees";

export function GeneralInvoiceTab() {
  const [invoices, setInvoices] = useState<GeneralInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<GeneralInvoice | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    items: [{ description: "", amount: "" }],
  });

  const invoiceTotal = getDraftItemsTotal(formData.items);

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "emerald" | "secondary" | "destructive" | "default"> = {
      published: "emerald",
      draft: "secondary",
      paid: "default",
      overdue: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      dueDate: "",
      items: [{ description: "", amount: "" }],
    });
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const items = await getFeeInvoices("general");
      setInvoices(items as GeneralInvoice[]);
    } catch (error) {
      setInvoices([]);
      toast.error("Failed to load general invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, []);

  const handleAdd = async () => {
    const items = normalizeDraftItems(formData.items);
    if (!formData.title || !formData.dueDate || items.length === 0) {
      toast.error("Please fill in the title, due date, and at least one item");
      return;
    }

    try {
      const createdInvoice = await createFeeInvoice({
        type: "general",
        title: formData.title,
        description: formData.description,
        amount: invoiceTotal,
        items,
        dueDate: formData.dueDate,
        status: "draft",
      });

      if (createdInvoice?.type === "general") {
        setInvoices((current) => [...current, createdInvoice]);
      } else {
        await loadInvoices();
      }
      resetForm();
      setIsAddDialogOpen(false);
      toast.success("General invoice created successfully");
    } catch (error) {
      toast.error("Failed to create invoice");
    }
  };

  const handleEdit = async () => {
    const items = normalizeDraftItems(formData.items);
    if (!selectedInvoice || !formData.title || !formData.dueDate || items.length === 0) {
      toast.error("Please fill in the title, due date, and at least one item");
      return;
    }

    try {
      const updatedInvoice = await updateFeeInvoice(selectedInvoice.id, {
        type: "general",
        title: formData.title,
        description: formData.description,
        amount: invoiceTotal,
        items,
        dueDate: formData.dueDate,
      });

      setInvoices((current) =>
        current.map((inv) =>
          inv.id === selectedInvoice.id
            ? ((updatedInvoice?.type === "general"
                ? updatedInvoice
                : {
                    ...inv,
                    title: formData.title,
                    description: formData.description,
                    amount: invoiceTotal,
                    items,
                    dueDate: formData.dueDate,
                  }) as GeneralInvoice)
            : inv,
        ),
      );
      setIsEditDialogOpen(false);
      setSelectedInvoice(null);
      resetForm();
      toast.success("Invoice updated successfully");
    } catch (error) {
      toast.error("Failed to update invoice");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeeInvoice(id);
      setInvoices((current) => current.filter((inv) => inv.id !== id));
      toast.success("Invoice deleted successfully");
    } catch (error) {
      toast.error("Failed to delete invoice");
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const publishedInvoice = await publishFeeInvoice(id);
      setInvoices((current) =>
        current.map((inv) =>
          inv.id === id
            ? ((publishedInvoice?.type === "general"
                ? publishedInvoice
                : { ...inv, status: "published" as const }) as GeneralInvoice)
            : inv,
        ),
      );
      toast.success("Invoice published to all active students");
    } catch (error) {
      toast.error("Failed to publish invoice");
    }
  };

  const openEditDialog = (invoice: GeneralInvoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      title: invoice.title,
      description: invoice.description,
      dueDate: invoice.dueDate,
      items: toDraftItems(invoice.items),
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (invoice: GeneralInvoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const renderFormFields = (titleId: string, descriptionId: string, dueDateId: string) => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Invoice Title *</Label>
        <Input
          id={titleId}
          placeholder="e.g., Registration and Tuition Fees"
          value={formData.title}
          onChange={(event) => setFormData({ ...formData, title: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={descriptionId}>Description</Label>
        <Textarea
          id={descriptionId}
          placeholder="Invoice description..."
          value={formData.description}
          onChange={(event) => setFormData({ ...formData, description: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={dueDateId}>Due Date *</Label>
        <Input
          id={dueDateId}
          type="date"
          value={formData.dueDate}
          onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
        />
      </div>
      <InvoiceItemsEditor
        items={formData.items}
        onChange={(items) => setFormData({ ...formData, items })}
        total={invoiceTotal}
        formatCurrency={formatCurrency}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>General Invoices</CardTitle>
            <CardDescription>
              Invoices applied to every active student
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-9 w-64"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create General Invoice</DialogTitle>
                  <DialogDescription>
                    Create an invoice for every active student
                  </DialogDescription>
                </DialogHeader>
                {renderFormFields("title", "description", "dueDate")}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAdd}>Create Invoice</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{invoice.title}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>{invoice.dueDate}</TableCell>
                    <TableCell>All active students</TableCell>
                    <TableCell>{invoice.studentsAffected.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openViewDialog(invoice)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(invoice)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {invoice.status === "draft" && (
                          <Button variant="ghost" size="icon-sm" onClick={() => handlePublish(invoice.id)}>
                            <Send className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(invoice.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>Update invoice details</DialogDescription>
          </DialogHeader>
          {renderFormFields("edit-title", "edit-description", "edit-dueDate")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice ID</p>
                  <p className="font-medium">{selectedInvoice.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{selectedInvoice.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedInvoice.description || "No description"}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Items</p>
                {(selectedInvoice.items || []).map((item, index) => (
                  <div key={index} className="flex justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{item.description}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold text-lg">{formatCurrency(selectedInvoice.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{selectedInvoice.dueDate}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
