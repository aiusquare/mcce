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
import { Plus, Search, Edit, Trash2, Eye, Send, User } from "lucide-react";
import { toast } from "sonner";
import { IndividualInvoice } from "./InvoiceTypes";
import {
  getDraftItemsTotal,
  InvoiceItemsEditor,
  normalizeDraftItems,
  toDraftItems,
} from "./InvoiceItemsEditor";
import {
  createFeeInvoice,
  deleteFeeInvoice,
  FeeStudent,
  getFeeInvoices,
  getFeeStudents,
  publishFeeInvoice,
  updateFeeInvoice,
} from "@/lib/fees";

export function IndividualInvoiceTab() {
  const [invoices, setInvoices] = useState<IndividualInvoice[]>([]);
  const [students, setStudents] = useState<FeeStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<IndividualInvoice | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<FeeStudent | null>(null);
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
      invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.studentId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(studentSearchQuery.toLowerCase()),
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
    setSelectedStudent(null);
    setStudentSearchQuery("");
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoiceItems, studentItems] = await Promise.all([
        getFeeInvoices("individual"),
        getFeeStudents(),
      ]);
      setInvoices(invoiceItems as IndividualInvoice[]);
      setStudents(studentItems);
    } catch (error) {
      setInvoices([]);
      setStudents([]);
      toast.error("Failed to load individual invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAdd = async () => {
    const items = normalizeDraftItems(formData.items);
    if (!formData.title || !formData.dueDate || !selectedStudent || items.length === 0) {
      toast.error("Please fill in all required fields, select a student, and add at least one item");
      return;
    }

    try {
      const createdInvoice = await createFeeInvoice({
        type: "individual",
        title: formData.title,
        description: formData.description,
        amount: invoiceTotal,
        items,
        dueDate: formData.dueDate,
        status: "draft",
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentEmail: selectedStudent.email,
        program: selectedStudent.program,
        level: selectedStudent.level,
      });

      if (createdInvoice?.type === "individual") {
        setInvoices((current) => [...current, createdInvoice]);
      } else {
        await loadData();
      }
      resetForm();
      setIsAddDialogOpen(false);
      toast.success("Individual invoice created successfully");
    } catch (error) {
      toast.error("Failed to create invoice");
    }
  };

  const handleEdit = async () => {
    const items = normalizeDraftItems(formData.items);
    if (!selectedInvoice || !formData.title || !formData.dueDate || items.length === 0) {
      toast.error("Please fill in all required fields and add at least one item");
      return;
    }

    try {
      const updatedInvoice = await updateFeeInvoice(selectedInvoice.id, {
        type: "individual",
        title: formData.title,
        description: formData.description,
        amount: invoiceTotal,
        items,
        dueDate: formData.dueDate,
      });

      setInvoices((current) =>
        current.map((inv) =>
          inv.id === selectedInvoice.id
            ? ((updatedInvoice?.type === "individual"
                ? updatedInvoice
                : {
                    ...inv,
                    title: formData.title,
                    description: formData.description,
                    amount: invoiceTotal,
                    items,
                    dueDate: formData.dueDate,
                  }) as IndividualInvoice)
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
            ? ((publishedInvoice?.type === "individual"
                ? publishedInvoice
                : { ...inv, status: "published" as const }) as IndividualInvoice)
            : inv,
        ),
      );
      toast.success("Invoice sent to student");
    } catch (error) {
      toast.error("Failed to publish invoice");
    }
  };

  const openEditDialog = (invoice: IndividualInvoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      title: invoice.title,
      description: invoice.description,
      dueDate: invoice.dueDate,
      items: toDraftItems(invoice.items),
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (invoice: IndividualInvoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const renderStudentPicker = () => (
    <div className="grid gap-2">
      <Label>Select Student *</Label>
      {selectedStudent ? (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{selectedStudent.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedStudent.id} - {selectedStudent.program}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Search student by name or ID..."
            value={studentSearchQuery}
            onChange={(event) => setStudentSearchQuery(event.target.value)}
          />
          {studentSearchQuery && (
            <div className="max-h-40 overflow-y-auto border rounded-lg">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
                  onClick={() => {
                    setSelectedStudent(student);
                    setStudentSearchQuery("");
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.id} - {student.program} - {student.level}
                    </p>
                  </div>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  No students found
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderFormFields = (isEdit = false) => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      {!isEdit && renderStudentPicker()}
      {isEdit && selectedInvoice && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{selectedInvoice.studentName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedInvoice.studentId} - {selectedInvoice.program}
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={isEdit ? "edit-title" : "title"}>Invoice Title *</Label>
        <Input
          id={isEdit ? "edit-title" : "title"}
          placeholder="e.g., Late Registration Penalty"
          value={formData.title}
          onChange={(event) => setFormData({ ...formData, title: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={isEdit ? "edit-description" : "description"}>Description</Label>
        <Textarea
          id={isEdit ? "edit-description" : "description"}
          placeholder="Invoice description..."
          value={formData.description}
          onChange={(event) => setFormData({ ...formData, description: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={isEdit ? "edit-dueDate" : "dueDate"}>Due Date *</Label>
        <Input
          id={isEdit ? "edit-dueDate" : "dueDate"}
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
            <CardTitle>Individual Invoices</CardTitle>
            <CardDescription>
              One-on-one invoices for specific students
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by student or invoice..."
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
                  <DialogTitle>Create Individual Invoice</DialogTitle>
                  <DialogDescription>
                    Create an invoice for a specific student
                  </DialogDescription>
                </DialogHeader>
                {renderFormFields()}
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
                <TableHead>Student</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Program</TableHead>
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
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.studentName}</p>
                        <p className="text-sm text-muted-foreground">{invoice.studentId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.title}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>{invoice.dueDate}</TableCell>
                    <TableCell>{invoice.program}</TableCell>
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
          {renderFormFields(true)}
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
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Student</p>
                <p className="font-medium">{selectedInvoice.studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoice.studentId} - {selectedInvoice.studentEmail}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoice.program} - {selectedInvoice.level}
                </p>
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
