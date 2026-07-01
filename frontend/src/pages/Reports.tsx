"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Package,
  IndianRupee,
  Users,
  Truck,
  BarChart3,
  PieChart,
  History,
  Loader2,
  Table as TableIcon,
  Search,
  Filter,
  MoreVertical,
  XCircle,
  CreditCard,
  Plus,
  RefreshCcw
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { generateInvoice, generatePaymentStatement } from "@/lib/invoiceGenerator";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

// Helper to load image
const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve("");
      return;
    }
    const img = new Image();
    img.src = url;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (err) => reject(err);
  });
};

const reportCategories = [
  {
    title: "Sales Reports",
    icon: IndianRupee,
    description: "Revenue, transactions, and sales performance",
    reports: [
      { name: "Monthly Sales Summary", endpoint: "/api/reports/sales/summary" },
      { name: "Sales by Product Category", endpoint: "/api/reports/sales/category" },
    ],
  },
  {
    title: "Inventory Reports",
    icon: Package,
    description: "Stock levels, movements, and valuations",
    reports: [
      { name: "Product Stock Levels", endpoint: "/api/reports/inventory/products" },
      { name: "Raw Material Stock", endpoint: "/api/reports/inventory/raw-materials" },
    ],
  },
  {
    title: "Order Reports",
    icon: FileText,
    description: "Order status, fulfillment, and trends",
    reports: [
      { name: "Order History", endpoint: "/api/reports/orders/history" },
      { name: "Pending Orders", endpoint: "/api/reports/orders/pending" },
    ],
  },
  {
    title: "Supplier & Customer",
    icon: Users,
    description: "Performance and insights",
    reports: [
      { name: "Supplier Performance", endpoint: "/api/reports/suppliers/performance" },
      { name: "Top Customers", endpoint: "/api/reports/customers/top" },
    ],
  },
  {
    title: "Admin Reports",
    icon: Users,
    description: "System activity and logs",
    reports: [
      { name: "User Activity Log", endpoint: "/api/reports/activity-log" },
    ],
  },
];

const Reports = () => {
  /* State Management */
  const [view, setView] = React.useState<"sales" | "reports" | "cancelled">("sales");
  const [orders, setOrders] = React.useState<any[]>([]);
  const [salesOrders, setSalesOrders] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [salesSearchTerm, setSalesSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState<"all" | "pending" | "completed">("all");
  const [loading, setLoading] = React.useState(false);
  const [generatingReport, setGeneratingReport] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({ start: "", end: "" });
  const [salesDateRange, setSalesDateRange] = React.useState({ start: "", end: "" });

  // Restore Modal State
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = React.useState(false);
  const [orderToRestore, setOrderToRestore] = React.useState<string | null>(null);

  // Payment Modal State
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);
  const [downloadingReceiptIndex, setDownloadingReceiptIndex] = React.useState<number | null>(null);
  const [isDownloadingStatement, setIsDownloadingStatement] = React.useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = React.useState<string | null>(null);

  /* Data Fetching */
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/orders");
      if (view === "cancelled") {
        setOrders(data.filter((o: any) => o.status === "Cancelled"));
      } else if (view === "sales") {
        setSalesOrders(data.filter((o: any) => o.status === "Completed"));
      }
    } catch (error) {
      console.error("Failed to fetch orders", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOrders();
  }, [view]);

  /* Filtering Logic for Cancel History */
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const sanitizedSearch = searchTerm.replace(/^#/, "").toLowerCase().trim();
      const orderId = (order.orderId || order.id || "").toLowerCase();
      const customer = (order.customerName || order.customer || "").toLowerCase();
      const invoiceNo = (order.invoiceNo || "").toLowerCase();

      const matchesSearch =
        customer.includes(sanitizedSearch) ||
        orderId.includes(sanitizedSearch) ||
        invoiceNo.includes(sanitizedSearch);

      const matchesType =
        typeFilter === "all" ||
        (order.customerType || "").toLowerCase() === typeFilter.toLowerCase();

      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "completed" && (order.previousStatus === "Completed" || (!order.previousStatus && (order.balanceDue === 0 || !order.balanceDue)))) ||
        (sourceFilter === "pending" && (order.previousStatus !== "Completed" && (order.previousStatus || (order.balanceDue > 0))));

      return matchesSearch && matchesType && matchesSource;
    });
  }, [orders, searchTerm, typeFilter, sourceFilter]);

  /* Filtering Logic for Sales Report */
  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter((order) => {
      const sanitizedSearch = salesSearchTerm.toLowerCase().trim();
      const matchesCustomer = (order.customerName || order.customer || "").toLowerCase().includes(sanitizedSearch);
      const matchesPlant = order.items?.some((item: any) =>
        (item.name || "").toLowerCase().includes(sanitizedSearch)
      );
      const matchesOrderId = (order.orderId || order.id || "").toLowerCase().includes(sanitizedSearch);
      const matchesInvoiceNo = (order.invoiceNo || "").toLowerCase().includes(sanitizedSearch);

      let matchesDate = true;
      if (salesDateRange.start || salesDateRange.end) {
        const orderDate = new Date(order.createdAt || order.date);
        if (salesDateRange.start) {
          const start = new Date(salesDateRange.start);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && orderDate >= start;
        }
        if (salesDateRange.end) {
          const end = new Date(salesDateRange.end);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= end;
        }
      }

      return (matchesCustomer || matchesPlant || matchesOrderId || matchesInvoiceNo) && matchesDate;
    });
  }, [salesOrders, salesSearchTerm, salesDateRange]);

  /* Order Actions */
  const handleRestoreOrder = async (orderId: string) => {
    try {
      const order = orders.find((o: any) => o.id === orderId);
      const prevStatus = order?.previousStatus || "Pending";
      await api.patch(`/api/orders/${orderId}/status`, { status: prevStatus });
      toast.success(`Order restored to ${prevStatus.toLowerCase()} successfully`);
      fetchOrders();
    } catch (error) {
      console.error("Failed to restore order:", error);
      toast.error("Failed to restore order");
    }
  };

  const handleDownloadInvoice = async (order: any, index: number) => {
    setDownloadingReceiptIndex(index);
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get(`/api/orders/${order.id}`),
        api.get("/api/company-settings")
      ]);
      const fullOrder = orderRes.data;
      const companyDetails = settingsRes.data;
      await generateInvoice({ ...fullOrder, orderId: fullOrder._id, companyDetails });
      toast.success("Invoice downloaded");
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error(`Failed to generate invoice: ${error.message || error}`);
    } finally {
      setDownloadingReceiptIndex(null);
    }
  };

  const handleDownloadInvoiceFromList = async (order: any) => {
    setDownloadingInvoiceId(order.id);
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get(`/api/orders/${order.id}`),
        api.get("/api/company-settings")
      ]);
      const fullOrder = orderRes.data;
      const companyDetails = settingsRes.data;
      await generateInvoice({ ...fullOrder, orderId: fullOrder._id, companyDetails });
      toast.success("Invoice downloaded");
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error(`Failed to generate invoice: ${error.message || error}`);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleDownloadStatement = async (order: any) => {
    setIsDownloadingStatement(true);
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get(`/api/orders/${order.id}`),
        api.get("/api/company-settings")
      ]);
      const fullOrder = orderRes.data;
      const companyDetails = settingsRes.data;
      await generatePaymentStatement({
        customerName: fullOrder.customerName,
        contact: fullOrder.contact,
        address: fullOrder.address,
        orderId: fullOrder._id,
        totalAmount: fullOrder.grandTotal,
        paymentHistory: fullOrder.paymentHistory || [],
        companyDetails: companyDetails
      });
      toast.success("Payment statement downloaded");
    } catch (error) {
      console.error("Error generating statement:", error);
      toast.error("Failed to generate statement");
    } finally {
      setIsDownloadingStatement(false);
    }
  };

  const openPaymentModal = (order: any) => {
    setSelectedOrder(order);
    setIsPaymentModalOpen(true);
  };

  /* Report Generation Helpers */
  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast.info("No data available for this report");
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        headers.map(fieldName => {
          const value = row[fieldName];
          const stringValue = value === null || value === undefined ? "" : String(value);
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const generatePDF = async (data: any[], title: string, filename: string) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Standard Header Layout
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

      // Logo
      try {
        const logoBase64 = await loadImage("/logo.png");
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", 6, 6, 25, 8);
        }
      } catch (e) {
        console.error("Logo load failed", e);
      }

      // Header Branding
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), pageWidth / 2, 12, { align: "center" });
      doc.line(5, 15, pageWidth - 5, 15);

      // Company Info
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("VASANTHA METAL INDUSTRY", 10, 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 10, 27);

      if (!data.length) {
        doc.setFontSize(12);
        doc.text("No data available for the selected period.", pageWidth / 2, 60, { align: "center" });
      } else {
        const headers = Object.keys(data[0]);
        const tableData = data.map(row => Object.values(row).map(v =>
          v === null || v === undefined ? "" : (typeof v === 'number' ? v.toLocaleString() : String(v))
        ));

        autoTable(doc, {
          head: [headers.map(h => h.toUpperCase())],
          body: tableData,
          startY: 40,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [45, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: 10, right: 10, bottom: 15 },
          didDrawPage: (data) => {
            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

            doc.setFontSize(7);
            doc.setFont("helvetica", "italic");
            doc.text("This is a computer-generated report.", pageWidth / 2, pageHeight - 8, { align: "center" });
          }
        });
      }
      doc.save(`${filename}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      toast.error("Failed to generate PDF");
    }
  };

  const handleDownloadReport = async (reportName: string, endpoint: string, formatType: 'csv' | 'pdf') => {
    try {
      setGeneratingReport(`${reportName}-${formatType}`);
      toast.info(`Generating ${reportName} (${formatType.toUpperCase()})...`);

      let url = endpoint;
      if (dateRange.start || dateRange.end) {
        const params = new URLSearchParams();
        if (dateRange.start) params.append('startDate', dateRange.start);
        if (dateRange.end) params.append('endDate', dateRange.end);
        url += `?${params.toString()}`;
      }

      const { data } = await api.get(url);
      const filename = reportName.replace(/\s+/g, '_').toLowerCase();

      if (formatType === 'csv') {
        downloadCSV(data, filename);
      } else {
        await generatePDF(data, reportName, filename);
      }
      toast.success(`${reportName} downloaded successfully`);
    } catch (error) {
      console.error(`Error generating ${reportName}:`, error);
      toast.error(`Failed to generate ${reportName}`);
    } finally {
      setGeneratingReport(null);
    }
  };

  const exportSalesReport = async (formatType: 'csv' | 'pdf') => {
    if (formatType === 'pdf') {
      const data = filteredSalesOrders.map(order => ({
        "Order ID": `#${(order.orderId || order.id || "").slice(-6).toUpperCase()}`,
        "Customer": order.customerName || order.customer,
        "Date": format(new Date(order.createdAt || order.date), 'MM/dd/yyyy'),
        "Total Amount": `Rs. ${(order.amount || 0).toLocaleString()}`,
        "Products": order.items?.map((i: any) => `${i.name} x ${i.quantity}`).join(', ')
      }));
      await generatePDF(data, "Sales Report", "sales_report");
    } else {
      const data = filteredSalesOrders.map(order => ({
        OrderID: `#${(order.orderId || order.id || "").slice(-6).toUpperCase()}`,
        Customer: order.customerName || order.customer,
        Phone: order.contact || "",
        Date: format(new Date(order.createdAt || order.date), 'MM/dd/yyyy'),
        TotalAmount: order.amount || 0,
        Products: order.items?.map((i: any) => `${i.name} x ${i.quantity}`).join('; ')
      }));
      downloadCSV(data, "sales_report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Manage business reports and order history</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === "sales" ? "default" : "outline"}
            className={cn(
              "h-10 px-6 font-medium transition-all",
              view === "sales"
                ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
            )}
            onClick={() => setView("sales")}
          >
            <TrendingUp className={cn("mr-2 h-4 w-4", view === "sales" ? "text-white" : "text-blue-500")} />
            Sales Report
          </Button>
          <Button
            variant={view === "reports" ? "default" : "outline"}
            className={cn(
              "h-10 px-6 font-medium transition-all",
              view === "reports"
                ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
            )}
            onClick={() => setView("reports")}
          >
            <FileText className={cn("mr-2 h-4 w-4", view === "reports" ? "text-white" : "text-blue-500")} />
            Other reports
          </Button>
          <Button
            variant={view === "cancelled" ? "default" : "outline"}
            className={cn(
              "h-10 px-6 font-medium transition-all",
              view === "cancelled"
                ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
            )}
            onClick={() => setView("cancelled")}
          >
            <XCircle className={cn("mr-2 h-4 w-4", view === "cancelled" ? "text-white" : "text-blue-500")} />
            Cancel History
          </Button>
        </div>
      </div>

      {view === "sales" && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search Order ID, Customer or items..."
                    className="pl-9 h-10 border-blue-200 focus-visible:ring-blue-600"
                    value={salesSearchTerm}
                    onChange={(e) => setSalesSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="h-10 border-blue-200 focus-visible:ring-blue-600"
                    value={salesDateRange.start}
                    onChange={(e) => setSalesDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    className="h-10 border-blue-200 focus-visible:ring-blue-600"
                    value={salesDateRange.end}
                    onChange={(e) => setSalesDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 h-10 px-6 font-medium"
                    onClick={() => fetchOrders()}
                  >
                    Go
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="h-10 bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm transition-colors group">
                      <Download className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportSalesReport('csv')} className="cursor-pointer">Excel (CSV)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportSalesReport('pdf')} className="cursor-pointer">PDF Document</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px] relative border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50/80 border-b">
                    <TableHead className="text-slate-600 font-semibold py-4">Order ID</TableHead>
                    <TableHead className="text-slate-600 font-semibold py-4">Customer</TableHead>
                    <TableHead className="text-slate-600 font-semibold py-4 text-center">Date</TableHead>
                    <TableHead className="text-slate-600 font-semibold py-4 text-right">Total Amount</TableHead>
                    <TableHead className="text-slate-600 font-semibold py-4 pl-8">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
                  ) : filteredSalesOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No delivered orders found</TableCell></TableRow>
                  ) : (
                    filteredSalesOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-blue-50/20 transition-colors border-b">
                        <TableCell className="font-bold text-slate-900">
                          #{(order.orderId || order.id || "").slice(-6).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{order.customerName || order.customer}</span>
                            <span className="text-xs text-muted-foreground">{order.contact || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-slate-600">{format(new Date(order.createdAt || order.date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="text-right font-bold text-slate-900 whitespace-nowrap">₹ {(order.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 pl-8 min-w-[200px]">
                          <ul className="space-y-1">
                            {order.items?.map((item: any, idx: number) => (
                              <li key={idx} className="text-sm text-slate-600 flex items-start gap-1.5">
                                <span className="text-blue-400 mt-1.5 leading-none">•</span>
                                <span className="flex-1">{item.name} &times; {item.quantity}</span>
                              </li>
                            ))}
                            {(order.items?.length === 0 || !order.items) && <span className="text-muted-foreground text-xs italic">No items listed</span>}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "reports" && (
        <div className="space-y-6">
          <div className="flex bg-muted/50 p-2 rounded-lg border w-full sm:w-auto self-end">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap px-2 flex items-center">
              Filter Date:
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
              <input
                type="date"
                className="h-9 w-full sm:w-auto rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="hidden sm:inline text-muted-foreground">-</span>
              <input
                type="date"
                className="h-9 w-full sm:w-auto rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors"
                value={dateRange.end}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
              {(dateRange.start || dateRange.end) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ start: "", end: "" })}
                  className="h-8 px-2 text-muted-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {reportCategories.map((category) => (
              <Card key={category.title} className="border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-900">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <category.icon className="h-5 w-5 text-slate-600" />
                    </div>
                    {category.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">{category.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 px-0">
                  <div className="space-y-1">
                    {category.reports.map((report) => (
                      <div key={report.name} className="flex items-center justify-between py-2 px-4 hover:bg-slate-50 transition-colors group">
                        <p className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{report.name}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-700 active:scale-95 transition-transform" disabled={generatingReport?.startsWith(report.name)}>
                              {generatingReport?.startsWith(report.name) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadReport(report.name, report.endpoint, 'csv')} className="cursor-pointer">Excel (CSV)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadReport(report.name, report.endpoint, 'pdf')} className="cursor-pointer">PDF Document</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {view === "cancelled" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search cancelled orders..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* Source Filter */}
                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-md border text-sm">
                  {["all", "pending", "completed"].map((f) => (
                    <Button
                      key={f}
                      variant={sourceFilter === f ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs capitalize px-3"
                      onClick={() => setSourceFilter(f as any)}
                    >
                      {f === "all" ? "All Sources" : f === "pending" ? "Pending Orders" : "Completed Orders"}
                    </Button>
                  ))}
                </div>
                {/* Customer Type Filter */}
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md border">
                  {["all", "individual", "business"].map((f) => (
                    <Button
                      key={f}
                      variant={typeFilter === f ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs capitalize px-3"
                      onClick={() => setTypeFilter(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="hidden sm:table-cell font-medium">#{order.orderId || order.id?.slice(-6).toUpperCase()}</TableCell>
                        <TableCell>{order.customerName || order.customer}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{format(new Date(order.createdAt || order.date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-semibold">₹{(order.amount || 0).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="destructive" className="bg-destructive/10 text-destructive">{order.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-600 focus:bg-blue-50" onClick={() => openPaymentModal(order)}>
                                <History className="mr-2 h-4 w-4" /> Payment History
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                                onClick={() => handleDownloadInvoiceFromList(order)}
                                disabled={downloadingInvoiceId === order.id}
                              >
                                {downloadingInvoiceId === order.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                <span>Download Invoice</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-green-600 focus:text-green-600 focus:bg-green-50"
                                onClick={() => {
                                  setOrderToRestore(order.id);
                                  setIsRestoreDialogOpen(true);
                                }}
                              >
                                <RefreshCcw className="mr-2 h-4 w-4" /> Restore to {order.previousStatus || 'Pending'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[550px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Order Payment Details (Cancelled)</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="p-6 pt-2 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="border rounded-lg p-6 bg-blue-50/50 text-center">
                  <p className="text-xs text-muted-foreground uppercase mb-1">Grand Total</p>
                  <p className="text-3xl font-bold text-blue-600">₹{(selectedOrder.amount || 0).toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-green-50/50 text-center">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Total Paid</p>
                    <p className="text-xl font-bold text-green-600">₹{(selectedOrder.paidAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-4 bg-red-50/50 text-center">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Balance Due</p>
                    <p className="text-xl font-bold text-destructive">₹{(selectedOrder.balanceDue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Payments</h3>
                  {selectedOrder.paymentHistory?.length > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleDownloadStatement(selectedOrder)} disabled={isDownloadingStatement}>
                      {isDownloadingStatement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Ledger
                    </Button>
                  )}
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!selectedOrder.paymentHistory?.length ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-sm">No history</TableCell></TableRow>
                      ) : (
                        [...selectedOrder.paymentHistory]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((h, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">{format(new Date(h.date), 'MMM dd, yyyy')}</TableCell>
                              <TableCell className="text-sm">{h.method}</TableCell>
                              <TableCell className="text-right font-medium">₹{h.amount.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                {idx === 0 && (
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownloadInvoice(selectedOrder, idx)} disabled={downloadingReceiptIndex === idx}>
                                    {downloadingReceiptIndex === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <div className="p-6 border-t flex justify-end">
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore Order to {orders.find((o: any) => o.id === orderToRestore)?.previousStatus || "Pending"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the order back to the {(orders.find((o: any) => o.id === orderToRestore)?.previousStatus || "Pending").toLowerCase()} list and re-deduct the items from stock.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orderToRestore && handleRestoreOrder(orderToRestore)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reports;
