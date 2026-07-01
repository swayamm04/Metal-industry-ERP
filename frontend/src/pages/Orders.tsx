"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { Search, Download, Loader2, FilterX, Filter, XCircle, Scale, FileText } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateInvoice, generateAdjustmentNote } from "@/lib/invoiceGenerator";
import { getCalculationMultiplier } from "@/lib/calculationUtils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Order {
  id: string;
  customer: string;
  date: string;
  items: any[];
  product: string;
  amount: number;
  status: string;
  customerType: string;
  balanceDue?: number;
  paidAmount?: number;
  includeGST?: boolean;
  invoiceNo?: string;
  hasAdjustment?: boolean;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "Completed":
      return "default";
    case "Processing":
      return "secondary";
    case "Shipped":
      return "outline";
    case "Pending":
      return "secondary";
    case "Cancelled":
      return "destructive";
    default:
      return "secondary";
  }
};

const Orders = ({ isSecret = false, isStandalone = false }: { isSecret?: boolean, isStandalone?: boolean }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Adjustment States
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [selectedOrderForAdjustment, setSelectedOrderForAdjustment] = useState<any | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'Credit' | 'Debit'>('Credit');
  const [adjustmentReason, setAdjustmentReason] = useState('Sales Return');
  const [selectedAdjustmentReason, setSelectedAdjustmentReason] = useState('Sales Return');
  const [customAdjustmentReason, setCustomAdjustmentReason] = useState('');
  const [adjustedItems, setAdjustedItems] = useState<any[]>([]);
  const [adjLoadingCharge, setAdjLoadingCharge] = useState(0);
  const [adjIncludeGST, setAdjIncludeGST] = useState(true);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const sanitizedSearch = searchTerm.replace(/^#/, "").toLowerCase().trim();
      const orderId = order.id ? order.id.toLowerCase() : "";

      const matchesSearch =
        order.customer.toLowerCase().includes(sanitizedSearch) ||
        orderId.includes(sanitizedSearch) ||
        (order.invoiceNo && order.invoiceNo.toLowerCase().includes(sanitizedSearch)) ||
        (order.product && order.product.toLowerCase().includes(sanitizedSearch));

      const matchesType =
        typeFilter === "all" ||
        order.customerType.toLowerCase() === typeFilter.toLowerCase();

      const isDone = order.status === "Completed";

      // Filter by GST status (secret/non-secret)
      const matchesSecret = isSecret ? order.includeGST === false : (order.includeGST === true || order.includeGST === undefined);

      return matchesSearch && matchesType && isDone && matchesSecret;
    });
  }, [orders, searchTerm, typeFilter, isSecret]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await api.get(`/api/orders${isSecret ? "?secret=true" : ""}`);
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleDownloadInvoice = async (orderId: string) => {
    setDownloadingId(orderId);
    try {
      const { data: order } = await api.get(`/api/orders/${orderId}`);
      const { data: settings } = await api.get("/api/company-settings");

      await generateInvoice({
        ...order,
        orderId: order._id,
        date: order.createdAt,
        companyDetails: settings,
      });

      toast.success("Invoice downloaded!");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    setIsSubmittingCancel(true);
    try {
      await api.patch(`/api/orders/${orderToCancel}/status`, { status: "Cancelled" });
      toast.success("Order cancelled successfully");
      setIsCancelDialogOpen(false);
      
      // Auto-download the cancelled bill!
      try {
        const { data: order } = await api.get(`/api/orders/${orderToCancel}`);
        const { data: settings } = await api.get("/api/company-settings");
        await generateInvoice({
          ...order,
          orderId: order._id,
          date: order.createdAt,
          companyDetails: settings,
        });
        toast.success("Cancelled invoice downloaded");
      } catch (err) {
        console.error("Failed to auto-download cancelled invoice", err);
      }

      setOrderToCancel(null);
      // Refresh orders
      const { data } = await api.get(`/api/orders${isSecret ? "?secret=true" : ""}`);
      setOrders(data);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleOpenAdjustmentDialog = async (orderId: string) => {
    setLoadingOrderDetails(orderId);
    try {
      const { data: order } = await api.get(`/api/orders/${orderId}`);
      setSelectedOrderForAdjustment(order);
      setAdjLoadingCharge(order.loadingCharge || 0);
      setAdjIncludeGST(order.includeGST !== false);
      setAdjustmentType('Credit');
      setAdjustmentReason('Sales Return');
      setSelectedAdjustmentReason('Sales Return');
      setCustomAdjustmentReason('');
      
      const mappedItems = order.items.map((item: any) => ({
        productId: item.productId || item._id,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        unit: item.unit,
        category: item.category,
        hsnCode: item.hsnCode,
        customFields: item.customFields,
        calculationField: item.calculationField,
        adjustQty: item.quantity,
        adjustPrice: item.price,
        selected: true,
      }));
      setAdjustedItems(mappedItems);
      setIsAdjustmentDialogOpen(true);
    } catch (error) {
      console.error("Error loading order details for adjustment:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoadingOrderDetails(null);
    }
  };

  const handleToggleItemSelection = (index: number) => {
    setAdjustedItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  const handleUpdateAdjustQty = (index: number, val: number) => {
    setAdjustedItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const clamped = Math.max(0, Math.min(item.quantity, val));
        return { ...item, adjustQty: clamped };
      }
      return item;
    }));
  };

  const handleUpdateAdjustPrice = (index: number, val: number) => {
    setAdjustedItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, adjustPrice: Math.max(0, val) };
      }
      return item;
    }));
  };

  // Calculations for adjustment
  const calculatedSubtotal = useMemo(() => {
    return adjustedItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + ((item.adjustPrice || item.price) * item.adjustQty * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)), 0);
  }, [adjustedItems]);

  const taxableValue = calculatedSubtotal + adjLoadingCharge;
  const gstAmount = adjIncludeGST ? (taxableValue * 0.18) : 0;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const rawTotal = taxableValue + gstAmount;

  const roundedTotal = Math.ceil(rawTotal);
  const calculatedRoundOff = Number((roundedTotal - rawTotal).toFixed(2));

  const handleCreateAdjustment = async () => {
    if (!selectedOrderForAdjustment) return;
    const selectedItems = adjustedItems.filter(item => item.selected && item.adjustQty > 0);
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to adjust");
      return;
    }
    if (!adjustmentReason.trim()) {
      toast.error("Please specify a reason for adjustment");
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const orderData = {
        noteType: adjustmentType,
        originalOrder: selectedOrderForAdjustment._id,
        reason: adjustmentReason,
        items: selectedItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.adjustQty,
          price: item.adjustPrice || item.price,
          unit: item.unit,
          category: item.category,
          hsnCode: item.hsnCode,
          customFields: item.customFields,
          calculationField: item.calculationField
        })),
        subtotal: calculatedSubtotal,
        loadingCharge: adjLoadingCharge,
        cgst: cgstAmount,
        sgst: sgstAmount,
        grandTotal: roundedTotal,
        roundOff: calculatedRoundOff
      };

      const response = await api.post("/api/adjustment-notes", orderData);
      const createdNote = response.data;

      toast.success(`${adjustmentType} Note created successfully!`);
      setIsAdjustmentDialogOpen(false);

      // Fetch company settings for PDF rendering
      const { data: settings } = await api.get("/api/company-settings");

      // Download PDF
      await generateAdjustmentNote({
        ...createdNote,
        companyDetails: settings
      });

      // Refresh orders list
      const { data } = await api.get(`/api/orders${isSecret ? "?secret=true" : ""}`);
      setOrders(data);
    } catch (error) {
      console.error("Error creating adjustment note:", error);
      toast.error("Failed to create adjustment note");
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const Content = (
    <div className={`space-y-6 ${isStandalone ? "pt-4" : ""}`}>
      {!isStandalone && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isSecret ? "Secret Delivered Orders" : "Delivered Orders"}</h1>
            <p className="text-muted-foreground">
              {isSecret ? "View completed orders created without tax" : "View all delivered and completed orders"}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Loading orders...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">No orders found</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                    <TableRow 
                      key={order.id}
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        order.hasAdjustment && "bg-amber-50/20 hover:bg-amber-100/30 border-l-4 border-l-amber-500"
                      )}
                    >
                    <TableCell className="font-medium hidden sm:table-cell">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2">
                          {`#${order.id ? order.id.substring(Math.max(0, order.id.length - 6)).toUpperCase() : "N/A"}`}
                          {order.hasAdjustment && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50/50 text-[10px] py-0 px-1 font-semibold">
                              Note Issued
                            </Badge>
                          )}
                        </span>
                        {order.invoiceNo && <span className="text-xs text-muted-foreground font-semibold">{order.invoiceNo}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{order.customer}</TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap">
                      {format(new Date(order.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{order.items?.length || 0} Items</TableCell>
                    <TableCell className="whitespace-nowrap">₹{(order.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(order.id)}
                        disabled={downloadingId === order.id}
                        title="Download Invoice"
                      >
                        {downloadingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => handleOpenAdjustmentDialog(order.id)}
                        disabled={loadingOrderDetails === order.id}
                        title="Issue Credit/Debit Note"
                      >
                        {loadingOrderDetails === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Scale className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setOrderToCancel(order.id);
                          setIsCancelDialogOpen(true);
                        }}
                        title="Cancel Order"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the order and return the stock items to inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingCancel}>No, keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelOrder();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmittingCancel}
            >
              {isSubmittingCancel ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, cancel order"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credit / Debit Note Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Scale className="h-5 w-5 text-amber-600" />
              Issue Credit / Debit Note
            </DialogTitle>
            <DialogDescription>
              Adjust quantities, prices, or taxes for order {selectedOrderForAdjustment && `#${selectedOrderForAdjustment.invoiceNo || selectedOrderForAdjustment._id.substring(selectedOrderForAdjustment._id.length - 6).toUpperCase()}`}.
            </DialogDescription>
          </DialogHeader>

          {selectedOrderForAdjustment && (
            <div className="space-y-6 my-2 text-sm">
              {/* Note Type & Reason Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Adjustment Type</Label>
                  <RadioGroup
                    defaultValue="Credit"
                    value={adjustmentType}
                    onValueChange={(val: any) => {
                      setAdjustmentType(val);
                      const defaultRes = val === 'Credit' ? 'Sales Return' : 'Price Difference';
                      setAdjustmentReason(defaultRes);
                      setSelectedAdjustmentReason(defaultRes);
                      setCustomAdjustmentReason('');
                    }}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Credit" id="adj-credit" />
                      <Label htmlFor="adj-credit" className="cursor-pointer font-medium text-red-600">Credit Note (Refund/Return)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Debit" id="adj-debit" />
                      <Label htmlFor="adj-debit" className="cursor-pointer font-medium text-green-700">Debit Note (Charge Extra)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adj-reason" className="font-semibold">Reason for Note</Label>
                  <Select value={selectedAdjustmentReason} onValueChange={(val) => {
                    setSelectedAdjustmentReason(val);
                    if (val !== 'Other') {
                      setAdjustmentReason(val);
                    } else {
                      setAdjustmentReason(customAdjustmentReason);
                    }
                  }}>
                    <SelectTrigger id="adj-reason" className="w-full">
                      <SelectValue placeholder="Select Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {adjustmentType === 'Credit' ? (
                        <>
                          <SelectItem value="Sales Return">Sales Return</SelectItem>
                          <SelectItem value="Order Cancellation">Order Cancellation</SelectItem>
                          <SelectItem value="Quality Mismatch / Defective Item">Quality Mismatch / Defective Item</SelectItem>
                          <SelectItem value="Weight/Scale Mismatch">Weight/Scale Mismatch</SelectItem>
                          <SelectItem value="Post-Sales Discount / Rate Correction">Post-Sales Discount / Rate Correction</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Price Difference">Price Difference</SelectItem>
                          <SelectItem value="Scale/Weight Under-billed">Scale/Weight Under-billed</SelectItem>
                          <SelectItem value="Additional Dispatch Charges">Additional Dispatch Charges</SelectItem>
                          <SelectItem value="Rate Hike / Supplemental Billing">Rate Hike / Supplemental Billing</SelectItem>
                        </>
                      )}
                      <SelectItem value="Other">Other (Write Reason)</SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedAdjustmentReason === 'Other' && (
                    <Input
                      placeholder="Write custom reason..."
                      className="mt-2"
                      value={customAdjustmentReason}
                      onChange={(e) => {
                        setCustomAdjustmentReason(e.target.value);
                        setAdjustmentReason(e.target.value);
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Items List for adjustment */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Select Items to Adjust</Label>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-right">Original Qty</TableHead>
                        <TableHead className="text-right">Original Rate</TableHead>
                        <TableHead className="w-32 text-right">Adjust Rate</TableHead>
                        <TableHead className="w-32 text-right">Adjust Qty</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustedItems.map((item, index) => {
                        const multiplier = getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit);
                        const displayUnit = (item.calculationField?.unit || item.unit || 'pcs').toUpperCase();
                        const itemTotal = (item.adjustPrice || item.price) * (item.selected ? item.adjustQty : 0) * multiplier;

                        return (
                          <TableRow key={index} className={item.selected ? "bg-primary/5" : "opacity-60"}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleItemSelection(index)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.productName}
                              {item.calculationField && item.calculationField.value && item.calculationField.value.toString() !== "1" && (
                                <span className="text-xs text-muted-foreground block">
                                  {item.calculationField.label}: {item.calculationField.value} {item.calculationField.unit || ""}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {(item.quantity * multiplier).toFixed(2)} {displayUnit}
                            </TableCell>
                            <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                value={item.adjustPrice || ""}
                                disabled={!item.selected}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleUpdateAdjustPrice(index, val);
                                }}
                                className="h-8 text-right bg-background font-semibold"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                max={item.quantity * multiplier}
                                value={item.adjustQty}
                                disabled={!item.selected}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleUpdateAdjustQty(index, val / multiplier);
                                }}
                                className="h-8 text-right bg-background"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Summary Calculations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                {/* Left col: Loading charges adjustment */}
                <div className="space-y-3">
                  <Label htmlFor="adj-loading" className="font-semibold">Loading / Other Charges (₹)</Label>
                  <Input
                    id="adj-loading"
                    type="number"
                    value={adjLoadingCharge}
                    onChange={(e) => setAdjLoadingCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="max-w-[200px]"
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="adj-gst"
                      checked={adjIncludeGST}
                      onChange={(e) => setAdjIncludeGST(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="adj-gst" className="cursor-pointer text-xs font-semibold">Include GST (18%) in calculation</Label>
                  </div>
                </div>

                {/* Right col: Totals list */}
                <div className="space-y-2 bg-muted/30 p-4 rounded-lg border">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Adjusted Subtotal:</span>
                    <span>₹{calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {adjLoadingCharge > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Adjusted Loading Charges:</span>
                      <span>₹{adjLoadingCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Adjusted Taxable Value:</span>
                    <span>₹{taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {adjIncludeGST && (
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
                    <span className={adjustmentType === 'Credit' ? "text-red-600" : "text-green-700"}>
                      ₹{roundedTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setIsAdjustmentDialogOpen(false)}
              disabled={isSubmittingAdjustment}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAdjustment}
              disabled={isSubmittingAdjustment}
              className={adjustmentType === 'Credit' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-700 hover:bg-green-800 text-white"}
            >
              {isSubmittingAdjustment ? (
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

  if (isStandalone) return Content;

  return Content;
};

export default Orders;
