"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Download, Loader2, Filter, Trash2, FileText, ArrowLeftRight, Plus } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateAdjustmentNote } from "@/lib/invoiceGenerator";
import { getCalculationMultiplier } from "@/lib/calculationUtils";

interface AdjustmentNote {
  _id: string;
  noteNo: string;
  noteType: "Credit" | "Debit";
  originalOrder?: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  contact: string;
  address: string;
  companyName?: string;
  gstin?: string;
  stateName?: string;
  stateCode?: string;
  email?: string;
  items: any[];
  subtotal: number;
  loadingCharge: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  roundOff: number;
  reason: string;
  includeGST: boolean;
  isDummy: boolean;
  createdAt: string;
}

const AdjustmentNotes = ({ isSecret = false }: { isSecret?: boolean }) => {
  const [notes, setNotes] = useState<AdjustmentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Standalone Creation States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyContact, setPartyContact] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyCompanyName, setPartyCompanyName] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [partyStateName, setPartyStateName] = useState("");
  const [partyStateCode, setPartyStateCode] = useState("");
  const [partyEmail, setPartyEmail] = useState("");

  const [refInvoiceNo, setRefInvoiceNo] = useState("");
  const [refInvoiceDate, setRefInvoiceDate] = useState("");
  const [noteType, setNoteType] = useState<'Credit' | 'Debit'>('Debit');
  const [reason, setReason] = useState('Purchase Return');
  const [selectedReason, setSelectedReason] = useState('Purchase Return');
  const [customReason, setCustomReason] = useState('');
  
  const [standaloneItems, setStandaloneItems] = useState<any[]>([
    { productName: "", quantity: 0, price: 0, unit: "pcs", hsnCode: "" }
  ]);
  const [loadingCharge, setLoadingCharge] = useState(0);
  const [includeGST, setIncludeGST] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/adjustment-notes${isSecret ? "?secret=true" : ""}`);
      setNotes(data);
    } catch (error) {
      console.error("Error fetching adjustment notes:", error);
      toast.error("Failed to load adjustment notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [isSecret]);

  // Filter notes based on search term and type
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        note.noteNo.toLowerCase().includes(query) ||
        note.invoiceNo.toLowerCase().includes(query) ||
        note.customerName.toLowerCase().includes(query) ||
        note.reason.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" ||
        note.noteType.toLowerCase() === typeFilter.toLowerCase();

      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "customer" && !!note.originalOrder) ||
        (sourceFilter === "supplier" && !note.originalOrder);

      return matchesSearch && matchesType && matchesSource;
    });
  }, [notes, searchTerm, typeFilter, sourceFilter]);

  // KPIs
  const stats = useMemo(() => {
    let creditTotal = 0;
    let debitTotal = 0;
    let creditCount = 0;
    let debitCount = 0;

    notes.forEach((n) => {
      if (n.noteType === "Credit") {
        creditTotal += n.grandTotal || 0;
        creditCount++;
      } else {
        debitTotal += n.grandTotal || 0;
        debitCount++;
      }
    });

    return {
      creditTotal,
      debitTotal,
      creditCount,
      debitCount,
    };
  }, [notes]);

  const handleDownloadPDF = async (noteId: string) => {
    setDownloadingId(noteId);
    try {
      const { data: note } = await api.get(`/api/adjustment-notes/${noteId}`);
      const { data: settings } = await api.get("/api/company-settings");

      await generateAdjustmentNote({
        ...note,
        companyDetails: settings,
      });

      toast.success(`${note.noteType} Note downloaded successfully`);
    } catch (error) {
      console.error("Error downloading note PDF:", error);
      toast.error("Failed to download note PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    setIsSubmittingDelete(true);
    try {
      await api.delete(`/api/adjustment-notes/${noteToDelete}`);
      toast.success("Adjustment note deleted successfully");
      setIsDeleteDialogOpen(false);
      setNoteToDelete(null);
      fetchNotes();
    } catch (error) {
      console.error("Error deleting adjustment note:", error);
      toast.error("Failed to delete adjustment note");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Calculations for standalone creation
  const calculatedSubtotal = useMemo(() => {
    return standaloneItems.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.price) || 0;
      return sum + (q * p);
    }, 0);
  }, [standaloneItems]);

  const taxableValue = calculatedSubtotal + loadingCharge;
  const gstAmount = includeGST ? (taxableValue * 0.18) : 0;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const rawTotal = taxableValue + gstAmount;
  const roundedTotal = Math.ceil(rawTotal);
  const calculatedRoundOff = Number((roundedTotal - rawTotal).toFixed(2));

  const handleOpenCreateStandaloneDialog = () => {
    setPartyName("");
    setPartyContact("");
    setPartyAddress("");
    setPartyCompanyName("");
    setPartyGstin("");
    setPartyStateName("");
    setPartyStateCode("");
    setPartyEmail("");
    setRefInvoiceNo("");
    setRefInvoiceDate("");
    setNoteType("Debit");
    setReason("Purchase Return");
    setSelectedReason("Purchase Return");
    setCustomReason("");
    setStandaloneItems([
      { productName: "", quantity: 0, price: 0, unit: "pcs", hsnCode: "" }
    ]);
    setLoadingCharge(0);
    setIncludeGST(true);
    setIsCreateDialogOpen(true);
  };

  const handleAddStandaloneItemRow = () => {
    setStandaloneItems(prev => [
      ...prev,
      { productName: "", quantity: 0, price: 0, unit: "pcs", hsnCode: "" }
    ]);
  };

  const handleRemoveStandaloneItemRow = (index: number) => {
    if (standaloneItems.length === 1) {
      toast.warning("At least one item is required");
      return;
    }
    setStandaloneItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateStandaloneItemField = (index: number, field: string, value: any) => {
    setStandaloneItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleCreateStandaloneNote = async () => {
    if (!partyName.trim() || !partyContact.trim() || !partyAddress.trim()) {
      toast.error("Party Name, Contact, and Address are required");
      return;
    }
    const validItems = standaloneItems.filter(item => item.productName.trim() && parseFloat(item.quantity) > 0 && parseFloat(item.price) > 0);
    if (validItems.length === 0) {
      toast.error("At least one valid item with quantity and rate > 0 is required");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const payload = {
        noteType,
        reason,
        invoiceNo: refInvoiceNo || "N/A",
        invoiceDate: refInvoiceDate || new Date(),
        customerName: partyName,
        contact: partyContact,
        address: partyAddress,
        companyName: partyCompanyName || undefined,
        gstin: partyGstin || undefined,
        stateName: partyStateName || undefined,
        stateCode: partyStateCode || undefined,
        email: partyEmail || undefined,
        items: validItems.map(item => ({
          productName: item.productName,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price),
          unit: item.unit,
          hsnCode: item.hsnCode || undefined
        })),
        subtotal: calculatedSubtotal,
        loadingCharge,
        cgst: cgstAmount,
        sgst: sgstAmount,
        grandTotal: roundedTotal,
        roundOff: calculatedRoundOff,
        includeGST,
        isDummy: isSecret
      };

      const { data: createdNote } = await api.post("/api/adjustment-notes", payload);
      toast.success(`${noteType} Note created successfully`);
      setIsCreateDialogOpen(false);

      // Fetch company settings to download PDF
      const { data: settings } = await api.get("/api/company-settings");
      await generateAdjustmentNote({
        ...createdNote,
        companyDetails: settings
      });

      // Refresh list
      fetchNotes();
    } catch (error: any) {
      console.error("Error creating standalone note:", error);
      toast.error(error.response?.data?.message || "Failed to create adjustment note");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit & Debit Notes</h1>
          <p className="text-muted-foreground">
            Manage credit notes (sales returns/cancellations) and debit notes (additional charges).
          </p>
        </div>
        <Button onClick={handleOpenCreateStandaloneDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Standalone Note
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credit Notes</CardTitle>
            <Badge variant="destructive" className="font-semibold text-xs">CN</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{stats.creditTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.creditCount} Credit Notes issued</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debit Notes</CardTitle>
            <Badge variant="outline" className="font-semibold text-xs border-green-500 text-green-600">DN</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{stats.debitTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.debitCount} Debit Notes issued</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Adjustment Value</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(stats.debitTotal - stats.creditTotal).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Difference between debit and credit notes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search note number, invoice, reason..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Credit Notes</SelectItem>
                  <SelectItem value="debit">Debit Notes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    <SelectValue placeholder="Filter Source" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="customer">Customer (Order-Linked)</SelectItem>
                  <SelectItem value="supplier">Supplier (Standalone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Original Invoice</TableHead>
                <TableHead>Customer / Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">Loading adjustment notes...</TableCell>
                </TableRow>
              ) : filteredNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">No adjustment notes found</TableCell>
                </TableRow>
              ) : (
                filteredNotes.map((note) => (
                  <TableRow key={note._id}>
                    <TableCell className="font-medium">{note.noteNo}</TableCell>
                    <TableCell>
                      {note.noteType === "Credit" ? (
                        <Badge variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-50 border-red-200">
                          Credit Note
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
                          Debit Note
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{note.invoiceNo}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{note.customerName}</span>
                        {note.originalOrder ? (
                          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-blue-200 text-blue-700 bg-blue-50/50">
                              Customer Order
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-200 text-amber-700 bg-amber-50/50">
                              Supplier / Standalone
                            </Badge>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(note.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={note.reason}>
                      {note.reason}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{(note.grandTotal || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadPDF(note._id)}
                        disabled={downloadingId === note._id}
                      >
                        {downloadingId === note._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setNoteToDelete(note._id);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the adjustment note. It will reverse any stock refills/deductions and adjust the customer ledger balances back. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteNote();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, delete note"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Standalone Adjustment Note Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Plus className="h-5 w-5 text-primary" />
              Create Standalone Credit / Debit Note
            </DialogTitle>
            <DialogDescription>
              Create a Credit Note (Sales/Purchase returns) or Debit Note manually. Fill in the party details and add item lines.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-2 text-sm">
            {/* Note Type & Reason Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
              <div className="space-y-2">
                <Label className="font-semibold">Adjustment Type</Label>
                <RadioGroup
                  value={noteType}
                  onValueChange={(val: any) => {
                    setNoteType(val);
                    if (val === 'Credit') {
                      setSelectedReason('Sales Return');
                      setReason('Sales Return');
                    } else {
                      setSelectedReason('Purchase Return');
                      setReason('Purchase Return');
                    }
                    setCustomReason('');
                  }}
                  className="flex gap-4 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Debit" id="standalone-debit" />
                    <Label htmlFor="standalone-debit" className="cursor-pointer font-medium text-green-700">Debit Note</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Credit" id="standalone-credit" />
                    <Label htmlFor="standalone-credit" className="cursor-pointer font-medium text-red-600">Credit Note</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="standalone-reason" className="font-semibold">Reason for Note</Label>
                <Select value={selectedReason} onValueChange={(val) => {
                  setSelectedReason(val);
                  if (val !== 'Other') {
                    setReason(val);
                  } else {
                    setReason(customReason);
                  }
                }}>
                  <SelectTrigger id="standalone-reason" className="w-full">
                    <SelectValue placeholder="Select Reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {noteType === 'Credit' ? (
                      <>
                        <SelectItem value="Sales Return">Sales Return</SelectItem>
                        <SelectItem value="Order Cancellation">Order Cancellation</SelectItem>
                        <SelectItem value="Quality Mismatch / Defective Item">Quality Mismatch / Defective Item</SelectItem>
                        <SelectItem value="Weight/Scale Mismatch">Weight/Scale Mismatch</SelectItem>
                        <SelectItem value="Post-Sales Discount / Rate Correction">Post-Sales Discount / Rate Correction</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Purchase Return">Purchase Return (Raw Materials Send Back)</SelectItem>
                        <SelectItem value="Price Difference">Price Difference</SelectItem>
                        <SelectItem value="Scale/Weight Under-billed">Scale/Weight Under-billed</SelectItem>
                        <SelectItem value="Additional Dispatch Charges">Additional Dispatch Charges</SelectItem>
                        <SelectItem value="Rate Hike / Supplemental Billing">Rate Hike / Supplemental Billing</SelectItem>
                      </>
                    )}
                    <SelectItem value="Other">Other (Write Reason)</SelectItem>
                  </SelectContent>
                </Select>

                {selectedReason === 'Other' && (
                  <Input
                    placeholder="Write custom reason..."
                    className="mt-2"
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value);
                      setReason(e.target.value);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Reference Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
              <div className="space-y-2">
                <Label htmlFor="standalone-refNo" className="font-semibold">Reference Invoice / Bill No.</Label>
                <Input
                  id="standalone-refNo"
                  placeholder="e.g. INV/1234 or SUPP-456"
                  value={refInvoiceNo}
                  onChange={(e) => setRefInvoiceNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standalone-refDate" className="font-semibold">Reference Invoice / Bill Date</Label>
                <Input
                  id="standalone-refDate"
                  type="date"
                  value={refInvoiceDate}
                  onChange={(e) => setRefInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Party / Supplier Info */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="font-bold text-base">Party / Customer / Supplier Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="standalone-partyName" className="font-semibold">Party Name *</Label>
                  <Input
                    id="standalone-partyName"
                    placeholder="Enter name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standalone-partyContact" className="font-semibold">Contact No *</Label>
                  <Input
                    id="standalone-partyContact"
                    placeholder="Enter 10-digit number"
                    value={partyContact}
                    onChange={(e) => setPartyContact(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standalone-partyEmail" className="font-semibold">Email</Label>
                  <Input
                    id="standalone-partyEmail"
                    type="email"
                    placeholder="Enter email (optional)"
                    value={partyEmail}
                    onChange={(e) => setPartyEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="standalone-partyAddress" className="font-semibold">Address *</Label>
                <Input
                  id="standalone-partyAddress"
                  placeholder="Enter full address"
                  value={partyAddress}
                  onChange={(e) => setPartyAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="standalone-partyCompanyName" className="font-semibold">Company Name (Business)</Label>
                  <Input
                    id="standalone-partyCompanyName"
                    placeholder="Enter company name (optional)"
                    value={partyCompanyName}
                    onChange={(e) => setPartyCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standalone-partyGstin" className="font-semibold">GSTIN</Label>
                  <Input
                    id="standalone-partyGstin"
                    placeholder="Enter GSTIN (optional)"
                    value={partyGstin}
                    onChange={(e) => setPartyGstin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="standalone-partyState" className="font-semibold">State</Label>
                      <Input
                        id="standalone-partyState"
                        placeholder="State"
                        value={partyStateName}
                        onChange={(e) => setPartyStateName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="standalone-partyStateCode" className="font-semibold">Code</Label>
                      <Input
                        id="standalone-partyStateCode"
                        placeholder="Code"
                        value={partyStateCode}
                        onChange={(e) => setPartyStateCode(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-base">Items list</Label>
                <Button variant="outline" size="sm" onClick={handleAddStandaloneItemRow} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Item Row
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-10">SI</TableHead>
                      <TableHead className="w-[30%]">Product Description *</TableHead>
                      <TableHead className="w-[15%]">HSN Code</TableHead>
                      <TableHead className="w-[15%] text-right">Quantity *</TableHead>
                      <TableHead className="w-[15%] text-right">Price/Rate *</TableHead>
                      <TableHead className="w-[15%]">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standaloneItems.map((item, index) => {
                      const q = parseFloat(item.quantity) || 0;
                      const p = parseFloat(item.price) || 0;
                      const itemTotal = q * p;

                      return (
                        <TableRow key={index}>
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              placeholder="Product name / specs"
                              value={item.productName}
                              onChange={(e) => handleUpdateStandaloneItemField(index, 'productName', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="HSN"
                              value={item.hsnCode}
                              onChange={(e) => handleUpdateStandaloneItemField(index, 'hsnCode', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="Qty"
                              value={item.quantity || ""}
                              onChange={(e) => handleUpdateStandaloneItemField(index, 'quantity', e.target.value)}
                              className="h-8 text-right font-semibold"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="Rate"
                              value={item.price || ""}
                              onChange={(e) => handleUpdateStandaloneItemField(index, 'price', e.target.value)}
                              className="h-8 text-right font-semibold"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.unit}
                              onValueChange={(val) => handleUpdateStandaloneItemField(index, 'unit', val)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">PCS</SelectItem>
                                <SelectItem value="kg">KG</SelectItem>
                                <SelectItem value="ton">TON</SelectItem>
                                <SelectItem value="ft">FT</SelectItem>
                                <SelectItem value="m">M</SelectItem>
                                <SelectItem value="sqft">SQFT</SelectItem>
                                <SelectItem value="nos">NOS</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStandaloneItemRow(index)}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Calculations & GST section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-3">
                <Label htmlFor="standalone-loading" className="font-semibold">Loading / Other Charges (₹)</Label>
                <Input
                  id="standalone-loading"
                  type="number"
                  value={loadingCharge || ""}
                  onChange={(e) => setLoadingCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="max-w-[200px]"
                />
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="standalone-gst"
                    checked={includeGST}
                    onChange={(e) => setIncludeGST(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor="standalone-gst" className="cursor-pointer text-xs font-semibold">Include GST (18%) in calculation</Label>
                </div>
              </div>

              <div className="space-y-2 bg-muted/30 p-4 rounded-lg border">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₹{calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {loadingCharge > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Loading Charges:</span>
                    <span>₹{loadingCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Taxable Value:</span>
                  <span>₹{taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {includeGST && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>CGST (9%):</span>
                      <span>₹{cgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>SGST (9%):</span>
                      <span>₹{sgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                {calculatedRoundOff > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Round Off:</span>
                    <span>₹{calculatedRoundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-1">
                  <span>Grand Total:</span>
                  <span className={noteType === 'Credit' ? "text-red-600" : "text-green-700"}>
                    ₹{roundedTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isSubmittingCreate}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStandaloneNote}
              disabled={isSubmittingCreate}
              className={noteType === 'Credit' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-700 hover:bg-green-800 text-white"}
            >
              {isSubmittingCreate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Save & Download PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdjustmentNotes;
