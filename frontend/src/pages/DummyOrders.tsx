"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Check, ChevronsUpDown, Loader2, Edit, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { generateInvoice } from "@/lib/invoiceGenerator";
import { getCalculationMultiplier, isBase12Unit } from "@/lib/calculationUtils";

interface OrderItem {
    id: string;
    productName: string;
    quantity: number;
    price: number;
    unit: string;
    category: string;
    stock: number;
    calculationField?: {
        label: string;
        value: string | number;
        unit: string;
    };
}

const DummyOrders = () => {
    const getLocalDateString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [createdAt, setCreatedAt] = useState(getLocalDateString());
    const [customerType, setCustomerType] = useState<"Individual" | "Business">("Individual");
    const [customerName, setCustomerName] = useState("");
    const [contact, setContact] = useState("");
    const [address, setAddress] = useState("");
    const [invoiceNo, setInvoiceNo] = useState("INV/");

    // Business specific state
    const [companyName, setCompanyName] = useState("");
    const [gstin, setGstin] = useState("");
    const [stateName, setStateName] = useState("");
    const [stateCode, setStateCode] = useState("");
    const [email, setEmail] = useState("");

    // Delivery Credentials state
    const [invoiceDate, setInvoiceDate] = useState("");
    const [deliveryNote, setDeliveryNote] = useState("");
    const [modeOfPayment, setModeOfPayment] = useState("");
    const [referenceNo, setReferenceNo] = useState("");
    const [otherReferences, setOtherReferences] = useState("");
    const [buyersOrderNo, setBuyersOrderNo] = useState("");
    const [buyersOrderDate, setBuyersOrderDate] = useState("");
    const [dispatchDocNo, setDispatchDocNo] = useState("");
    const [deliveryNoteDate, setDeliveryNoteDate] = useState("");
    const [dispatchedThrough, setDispatchedThrough] = useState("");
    const [destination, setDestination] = useState("");
    const [billOfLading, setBillOfLading] = useState("");
    const [motorVehicleNo, setMotorVehicleNo] = useState("");
    const [termsOfDelivery, setTermsOfDelivery] = useState("");

    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
    const [companyDetails, setCompanyDetails] = useState<any>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loadingCharge, setLoadingCharge] = useState(0);
    const [includeGST, setIncludeGST] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
    const [subtotal, setSubtotal] = useState(0);
    const [cgst, setCgst] = useState(0);
    const [sgst, setSgst] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [roundOff, setRoundOff] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dummyOrders, setDummyOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<any | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);


    const fetchData = async () => {
        try {
            const [productsRes, settingsRes, customersRes] = await Promise.all([
                api.get("/api/products"),
                api.get("/api/company-settings"),
                api.get("/api/customers")
            ]);
            setAvailableProducts(productsRes.data);
            setCompanyDetails(settingsRes.data);
            setAvailableCustomers(customersRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load required data");
        }
    };


    const handleClearHistory = async () => {
        if (!confirm("WARNING: This will permanently delete ALL dummy order history. Are you sure you want to proceed?")) return;

        try {
            setLoadingOrders(true);
            await api.delete("/api/orders/dummy");
            toast.success("Dummy history cleared successfully!");
            fetchDummyOrders();
        } catch (error) {
            console.error("Error clearing dummy history:", error);
            toast.error("Failed to clear dummy history");
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleDownloadInvoice = async (orderId: string) => {
        setDownloadingId(orderId);
        try {
            const { data: order } = await api.get(`/api/orders/${orderId}`);

            await generateInvoice({
                ...order,
                companyDetails,
                pageSize: 'a4'
            });

            toast.success("Invoice downloaded!");
        } catch (error) {
            console.error("Error downloading invoice:", error);
            toast.error("Failed to download invoice");
        } finally {
            setDownloadingId(null);
        }
    };

    const fetchDummyOrders = async () => {
        try {
            setLoadingOrders(true);
            const { data } = await api.get("/api/orders");
            const dOrders = data.filter((o: any) => o.isDummy === true && !o.isPastOrder);
            setDummyOrders(dOrders);
        } catch (error) {
            console.error("Error fetching dummy orders:", error);
            toast.error("Failed to load dummy orders");
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchDummyOrders();
    }, []);



    // Sync modeOfPayment with paymentMethod selection
    useEffect(() => {
        if (paymentMethod) {
            setModeOfPayment(paymentMethod.toUpperCase());
        }
    }, [paymentMethod]);

    useEffect(() => {
        const newSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.price * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)), 0);
        setSubtotal(newSubtotal);

        // Calculate grand total: Add-on GST if enabled
        const taxableValue = newSubtotal + loadingCharge;
        const gstAmount = includeGST ? (taxableValue * 0.18) : 0;
        const individualGst = gstAmount / 2;
        const rawTotal = taxableValue + gstAmount;

        // Round off logic: Round UP to nearest integer if there are decimals
        const roundedTotal = Math.ceil(rawTotal);
        const diff = Number((roundedTotal - rawTotal).toFixed(2));

        setGrandTotal(roundedTotal);
        setRoundOff(diff > 0 ? diff : 0);
        setCgst(individualGst);
        setSgst(individualGst);
    }, [items, loadingCharge, includeGST]);

    const addItem = () => {
        setItems([{ id: Date.now().toString(), productName: "", quantity: 1, price: 0, unit: "pcs", category: "", stock: 0 }, ...items]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: string, value: any) => {
        if (field === 'productName') {
            const selectedProduct = availableProducts.find(p => p._id === value);
            if (selectedProduct) {
                const isDuplicate = items.some(item =>
                    item.id !== id &&
                    item.productName === value &&
                    item.price === selectedProduct.price &&
                    item.calculationField?.value === selectedProduct.calculationField?.value
                );
                if (isDuplicate) {
                    toast.error("This product with the same price and calculation is already added");
                    return;
                }
            }
        }
        setItems(items.map(item => {
            if (item.id === id) {
                if (field === 'calculationValue') {
                    return {
                        ...item,
                        calculationField: item.calculationField ? { ...item.calculationField, value } : undefined
                    };
                }
                const updatedItem = { ...item, [field]: value };

                // Auto-fill price if productName (ID in this context) changes
                if (field === 'productName') {
                    const product = availableProducts.find(p => p._id === value);
                    if (product) {
                        updatedItem.price = product.price;
                        updatedItem.unit = product.unit || "pcs";
                        updatedItem.stock = product.stock || 0;
                        updatedItem.calculationField = product.calculationField;
                    }
                }

                return updatedItem;
            }
            return item;
        }));
    };

    const handleSelectCustomer = (customer: any) => {
        if (customerType === "Individual") {
            setCustomerName(customer.name);
        } else {
            setCompanyName(customer.companyName || customer.name);
        }
        setContact(customer.contact || "");
        setAddress(customer.address || "");
        setEmail(customer.email || "");
        setGstin(customer.gstin || "");
        setStateName(customer.stateName || "");
        setStateCode(customer.stateCode || "");
        setIsCustomerPopoverOpen(false);
        toast.info(`Details pre-filled for ${customerType === "Business" ? (customer.companyName || customer.name) : customer.name}`);
    };

    const generateInvoicePDF = async (orderData: any) => {
        await generateInvoice({
            ...orderData,
            paymentMethod,
            companyDetails,
            paidAmount: orderData.paidAmount,
            balanceDue: orderData.balanceDue,
            pageSize: 'a4'
        });
    };


    const handleDeleteOrder = async (id: string) => {
        if (!confirm("Are you sure you want to delete this dummy order?")) return;
        try {
            setDeletingId(id);
            await api.delete(`/api/orders/${id}`);
            toast.success("Dummy order deleted successfully");
            fetchDummyOrders();
        } catch (error) {
            console.error("Error deleting order:", error);
            toast.error("Failed to delete order");
        } finally {
            setDeletingId(null);
        }
    };

    const handleEditOrderDetail = async (orderId: string) => {
        try {
            const { data } = await api.get(`/api/orders/${orderId}`);
            setEditingOrder(data);

            // Pre-fill form
            setCustomerType(data.customerType || "Individual");
            setCustomerName(data.customerName || "");
            setCompanyName(data.companyName || "");
            setContact(data.contact || "");
            setAddress(data.address || "");
            setGstin(data.gstin || "");
            setStateName(data.stateName || "");
            setStateCode(data.stateCode || "");
            setEmail(data.email || "");

            setInvoiceNo(data.invoiceNo || "");
            setInvoiceDate(data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : "");
            setDeliveryNote(data.deliveryNote || "");
            setModeOfPayment(data.modeOfPayment || "");
            setReferenceNo(data.referenceNo || "");
            setOtherReferences(data.otherReferences || "");
            setBuyersOrderNo(data.buyersOrderNo || "");
            setBuyersOrderDate(data.buyersOrderDate ? new Date(data.buyersOrderDate).toISOString().split('T')[0] : "");
            setDispatchDocNo(data.dispatchDocNo || "");
            setDeliveryNoteDate(data.deliveryNoteDate ? new Date(data.deliveryNoteDate).toISOString().split('T')[0] : "");
            setDispatchedThrough(data.dispatchedThrough || "");
            setDestination(data.destination || "");
            setBillOfLading(data.billOfLading || "");
            setMotorVehicleNo(data.motorVehicleNo || "");
            setTermsOfDelivery(data.termsOfDelivery || "");

            setCreatedAt(data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : "");
            setIncludeGST(data.includeGST !== false);
            setPaymentMethod(data.paymentMethod || "cash");
            setLoadingCharge(data.loadingCharge || 0);

            // Map backend items to frontend OrderItem format
            const mappedItems: OrderItem[] = data.items.map((item: any, index: number) => {
                const product = availableProducts.find(p => p.name === item.productName);
                return {
                    id: `edit-${index}-${Date.now()}`,
                    productName: product ? product._id : item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    unit: item.unit || "pcs",
                    category: item.category || "",
                    stock: product ? product.stock : 0,
                    calculationField: item.calculationField
                };
            });
            setItems(mappedItems);

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            toast.info("Order loaded for editing");
        } catch (error) {
            console.error("Error fetching order details:", error);
            toast.error("Failed to load order details");
        }
    };


    const handleSubmit = async () => {
        const isBusiness = customerType === "Business";
        const primaryName = isBusiness ? companyName : customerName;

        if (!createdAt) {
            toast.error("Please select an Order Date");
            return;
        }

        if (!invoiceNo || !invoiceNo.startsWith("INV/")) {
            toast.error("Please enter a valid Invoice Number starting with INV/");
            return;
        }

        if (!primaryName || !address || !contact) {
            toast.error(`Please fill in required fields (${isBusiness ? "Company Name" : "Name"}, Address, Contact)`);
            return;
        }
        if (contact && contact.length !== 10) {
            toast.error("Contact number must be exactly 10 digits");
            return;
        }
        if (items.length === 0) {
            toast.error("Please add at least one item");
            return;
        }
        if (items.some(item => !item.productName)) {
            toast.error("Please select a product for all items in the list");
            return;
        }

        try {
            setIsSubmitting(true);
            // Map items to include actual product names if necessary before sending to API
            const formattedItems = items.map(item => {
                const product = availableProducts.find(p => p._id === item.productName);
                const returnItem: any = {
                    ...item,
                    category: product ? (product.category?.name || "No Category") : item.category,
                    hsnCode: product?.category?.hsnCode || "",
                    productName: product ? product.name : item.productName,
                    customFields: product ? product.customFields : [],
                    calculationField: item.calculationField || product?.calculationField,
                    unit: item.unit || product?.unit || 'pcs'
                };
                if (product) {
                    returnItem.productId = item.productName;
                }
                return returnItem;
            });


            const orderData = {
                customerName: isBusiness ? companyName : customerName,
                contact,
                address,
                items: formattedItems,
                subtotal,
                loadingCharge,
                cgst,
                sgst,
                grandTotal,
                roundOff,
                paidAmount: grandTotal,
                paymentMethod,
                balanceDue: 0,
                companyDetails,
                customerType,
                companyName,
                gstin,
                stateName,
                stateCode,
                email,
                includeGST,
                invoiceNo,
                invoiceDate,
                deliveryNote,
                modeOfPayment,
                referenceNo,
                otherReferences,
                buyersOrderNo,
                buyersOrderDate,
                dispatchDocNo,
                deliveryNoteDate,
                dispatchedThrough,
                destination,
                billOfLading,
                motorVehicleNo,
                termsOfDelivery,
                status: 'Completed',
                createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
                isDummy: true
            };

            // Save to database
            if (editingOrder) {
                await api.put(`/api/orders/${editingOrder._id}`, orderData);
                toast.success("Dummy order updated successfully!");
                setEditingOrder(null);
            } else {
                await api.post("/api/orders", orderData);
                toast.success("Dummy order saved successfully!");
            }



            fetchDummyOrders();

            // Reset form
            setCustomerName("");
            setContact("");
            setAddress("");
            setItems([]);
            setLoadingCharge(0);
            setCompanyName("");
            setGstin("");
            setStateName("");
            setStateCode("");
            setEmail("");
            setInvoiceNo("");
            setDeliveryNote("");
            setModeOfPayment("");
            setReferenceNo("");
            setOtherReferences("");
            setBuyersOrderNo("");
            setDispatchDocNo("");
            setDispatchedThrough("");
            setDestination("");
            setBillOfLading("");
            setMotorVehicleNo("");
            setTermsOfDelivery("");
            setCreatedAt(getLocalDateString());

        } catch (error) {
            console.error("Error creating order:", error);
            toast.error("Failed to place order");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Dummy Orders</h1>
                <p className="text-muted-foreground">Create dummy orders for testing or reporting without affecting main stock. Select a manual date. Dummy orders can be deleted later.</p>
            </div>

            <Card className="shadow-md">
                <CardContent className="p-6 space-y-8">
                    {/* Customer Type Toggle */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="font-semibold text-lg">Customer Type</Label>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="createdAt" className="text-sm font-semibold whitespace-nowrap text-muted-foreground">Order Date:</Label>
                                <Input
                                    id="createdAt"
                                    type="date"
                                    value={createdAt}
                                    onChange={(e) => setCreatedAt(e.target.value)}
                                    max={getLocalDateString()}
                                    className="w-40 h-9 text-sm"
                                />
                            </div>
                        </div>
                        <RadioGroup
                            defaultValue="Individual"
                            value={customerType}
                            onValueChange={(val: any) => setCustomerType(val)}
                            className="flex gap-6 mt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Individual" id="individual" />
                                <Label htmlFor="individual" className="cursor-pointer">Individual</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Business" id="business" />
                                <Label htmlFor="business" className="cursor-pointer">Business</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="pt-4 border-t">
                        <div className="flex flex-col space-y-4 max-w-md">
                            <Label htmlFor="invoiceNo" className="font-semibold text-lg">Invoice No. <span className="text-destructive">*</span></Label>
                            <div className="relative flex items-center group">
                                <span className="absolute left-3 flex items-center h-full text-muted-foreground font-bold pointer-events-none select-none border-r pr-2 py-2 group-focus-within:text-foreground transition-colors">
                                    INV/
                                </span>
                                <Input
                                    id="invoiceNo"
                                    type="text"
                                    value={invoiceNo.replace(/^INV\//, "")}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/^INV\/?/, "");
                                        setInvoiceNo("INV/" + val);
                                    }}
                                    placeholder="001"
                                    className="w-full pl-14 h-11 bg-background border-zinc-200 focus:border-primary transition-all font-mono"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Compulsory invoice number (prefix INV/ is already included).</p>
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold border-b pb-2">
                            {customerType === "Business" ? "Business & Customer Details" : "Customer Details"}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {customerType === "Individual" ? (
                                <div className="space-y-2">
                                    <Label htmlFor="customerName" className="font-semibold">Customer Name <span className="text-destructive">*</span></Label>
                                    <Popover
                                        open={isCustomerPopoverOpen && customerName.length > 0 && availableCustomers.filter(c => c.customerType === "Individual" && c.name.toLowerCase().includes(customerName.toLowerCase())).length > 0}
                                        onOpenChange={setIsCustomerPopoverOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input
                                                    id="customerName"
                                                    value={customerName}
                                                    onChange={(e) => {
                                                        setCustomerName(e.target.value);
                                                        if (e.target.value.length >= 1) setIsCustomerPopoverOpen(true);
                                                    }}
                                                    placeholder="Enter name"
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[90vw] sm:w-[300px] p-1 shadow-lg border-muted-foreground/20" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {availableCustomers
                                                    .filter(c => c.customerType === "Individual" && c.name.toLowerCase().includes(customerName.toLowerCase()))
                                                    .map((c) => (
                                                        <div
                                                            key={c._id}
                                                            onClick={() => handleSelectCustomer(c)}
                                                            className="flex flex-col px-3 py-2 cursor-pointer hover:bg-primary/5 rounded-sm transition-colors border-b last:border-0 border-muted/30"
                                                        >
                                                            <span className="font-medium text-sm">{c.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{c.contact}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="companyName" className="font-semibold">Company Name <span className="text-destructive">*</span></Label>
                                    <Popover
                                        open={isCustomerPopoverOpen && companyName.length > 0 && availableCustomers.filter(c => c.customerType === "Business" && (c.companyName?.toLowerCase().includes(companyName.toLowerCase()) || c.name.toLowerCase().includes(companyName.toLowerCase()))).length > 0}
                                        onOpenChange={setIsCustomerPopoverOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input
                                                    id="companyName"
                                                    value={companyName}
                                                    onChange={(e) => {
                                                        setCompanyName(e.target.value);
                                                        if (e.target.value.length >= 1) setIsCustomerPopoverOpen(true);
                                                    }}
                                                    placeholder="Enter company name"
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[90vw] sm:w-[300px] p-1 shadow-lg border-muted-foreground/20" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {availableCustomers
                                                    .filter(c => c.customerType === "Business" && (c.companyName?.toLowerCase().includes(companyName.toLowerCase()) || c.name.toLowerCase().includes(companyName.toLowerCase())))
                                                    .map((c) => (
                                                        <div
                                                            key={c._id}
                                                            onClick={() => handleSelectCustomer(c)}
                                                            className="flex flex-col px-3 py-2 cursor-pointer hover:bg-primary/5 rounded-sm transition-colors border-b last:border-0 border-muted/30"
                                                        >
                                                            <span className="font-medium text-sm">{c.companyName || c.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{c.contact}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="contact" className="font-semibold">Contact</Label>
                                <Input
                                    id="contact"
                                    value={contact}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setContact(val);
                                    }}
                                    placeholder="10-digit phone number"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address" className="font-semibold">Address <span className="text-destructive">*</span></Label>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Full address"
                                />
                            </div>

                            {customerType === "Business" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="gstin" className="font-semibold">GSTIN/UIN</Label>
                                        <Input
                                            id="gstin"
                                            value={gstin}
                                            onChange={(e) => setGstin(e.target.value)}
                                            placeholder="GST number"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="font-semibold">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Business email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="stateName" className="font-semibold">State Name</Label>
                                        <Input
                                            id="stateName"
                                            value={stateName}
                                            onChange={(e) => setStateName(e.target.value)}
                                            placeholder="e.g. Karnataka"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="stateCode" className="font-semibold">State Code</Label>
                                        <Input
                                            id="stateCode"
                                            value={stateCode}
                                            onChange={(e) => setStateCode(e.target.value)}
                                            placeholder="e.g. 29"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Delivery Credentials Section - Only for Business */}
                    <div className="space-y-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            Delivery Credentials
                            <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="deliveryNote">Delivery Note</Label>
                                <Input
                                    id="deliveryNote"
                                    value={deliveryNote}
                                    onChange={(e) => setDeliveryNote(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="deliveryNoteDate">Delivery Note Date</Label>
                                <Input
                                    id="deliveryNoteDate"
                                    type="date"
                                    value={deliveryNoteDate}
                                    onChange={(e) => setDeliveryNoteDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dispatchedThrough">Dispatched through</Label>
                                <Input
                                    id="dispatchedThrough"
                                    value={dispatchedThrough}
                                    onChange={(e) => setDispatchedThrough(e.target.value)}
                                    placeholder="e.g. VEHICLE"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="destination">Destination</Label>
                                <Input
                                    id="destination"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    placeholder="e.g. SHIVAMOGGA"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="motorVehicleNo">Motor Vehicle No.</Label>
                                <Input
                                    id="motorVehicleNo"
                                    value={motorVehicleNo}
                                    onChange={(e) => setMotorVehicleNo(e.target.value)}
                                    placeholder="e.g. KA17B1810"
                                />
                            </div>
                            <div className="col-span-full space-y-2">
                                <Label htmlFor="termsOfDelivery">Terms of Delivery</Label>
                                <Input
                                    id="termsOfDelivery"
                                    value={termsOfDelivery}
                                    onChange={(e) => setTermsOfDelivery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Order Items</h3>
                            <Button onClick={addItem} variant="default">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Product
                            </Button>
                        </div>

                        <div className="border rounded-md p-4 bg-muted/30 min-h-[100px] space-y-4">
                            {items.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No items added. Click "Add Product" to begin.</p>
                            ) : (
                                items.map((item, index) => (
                                    <div key={item.id} className="flex flex-col md:flex-row gap-4 items-end border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label className="font-semibold text-foreground">Product Name</Label>
                                            <Popover open={openPopoverId === item.id} onOpenChange={(open) => setOpenPopoverId(open ? item.id : null)}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className="w-full justify-between bg-muted/30 border-input text-left font-normal h-10 px-3"
                                                    >
                                                        <span className={cn(
                                                            "truncate",
                                                            !item.productName && "text-muted-foreground"
                                                        )}>
                                                            {item.productName
                                                                ? availableProducts.find((p) => p._id === item.productName)?.name
                                                                : "Search Product Name..."}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[90vw] sm:w-[500px] p-0" align="start">
                                                    <Command className="border-0">
                                                        <CommandInput placeholder="Type a product name..." autoComplete="off" className="border-none focus:ring-0" />
                                                        <CommandList className="max-h-[300px]">
                                                            <CommandEmpty>No matching products found.</CommandEmpty>
                                                            <CommandGroup heading="Existing Products">
                                                                {availableProducts.map((p) => (
                                                                    <CommandItem
                                                                        key={p._id}
                                                                        value={`${p.name} ${p.category?.name || ""} ${p.customFields?.filter((f: any) => f.value && f.value.toString().trim() !== "").map((f: any) => f.value).join(" ")}`.trim()}
                                                                        onSelect={() => {
                                                                            updateItem(item.id, 'productName', p._id);
                                                                            setOpenPopoverId(null);
                                                                        }}
                                                                        className="group cursor-pointer transition-colors data-[selected=true]:bg-slate-100 hover:bg-slate-100 active:bg-slate-200"
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                item.productName === p._id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-bold text-foreground group-data-[selected=true]:text-foreground transition-colors">{p.name}</span>
                                                                                <Badge variant="outline" className="text-[10px] h-4 px-1 border-muted-foreground/30 text-muted-foreground group-data-[selected=true]:text-foreground group-data-[selected=true]:border-foreground/20 uppercase transition-colors">
                                                                                    {p.unit || 'pcs'}
                                                                                </Badge>
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground group-data-[selected=true]:text-muted-foreground transition-colors">
                                                                                Price: ₹{p.price} | Category: <span className="font-semibold group-data-[selected=true]:text-foreground">{p.category?.name || "No Category"}</span>
                                                                            </span>
                                                                            {p.customFields && p.customFields.filter((f: any) => f.value && f.value.toString().trim() !== "").length > 0 && (
                                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                                    {p.customFields
                                                                                        .filter((f: any) => f.value && f.value.toString().trim() !== "")
                                                                                        .map((f: any, i: number) => (
                                                                                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded transition-all border border-muted-foreground/20 text-muted-foreground group-data-[selected=true]:text-foreground group-data-[selected=true]:border-foreground/10">
                                                                                                {f.label}: {f.value}{f.unit ? ` ${f.unit}` : ""}
                                                                                            </span>
                                                                                        ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        {item.calculationField && item.calculationField.label && (
                                            <div className="w-full md:w-28 space-y-2 text-left">
                                                <Label className="text-xs font-semibold">
                                                    {item.calculationField.label} {item.calculationField.unit ? `(${item.calculationField.unit})` : ""}
                                                </Label>
                                                <Input
                                                    type="text"
                                                    className="h-10 bg-zinc-50 border-zinc-200"
                                                    value={item.calculationField.value}
                                                    onChange={(e) => updateItem(item.id, 'calculationValue', e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={(e) => {
                                                        if (e.target.value === "") updateItem(item.id, 'calculationValue', "1");
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="w-full md:w-24 space-y-2">
                                            <Label>Qty ({item.unit || 'pcs'})</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value === "" ? "" : parseFloat(e.target.value) || 1)}
                                                onFocus={(e) => e.target.select()}
                                                onBlur={(e) => {
                                                    if (e.target.value === "") updateItem(item.id, 'quantity', 1);
                                                }}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                className={cn(
                                                    "bg-background",
                                                    item.productName && item.quantity > item.stock && (
                                                        item.stock <= 0
                                                            ? "border-destructive focus-visible:ring-destructive"
                                                            : "border-orange-500 focus-visible:ring-orange-500"
                                                    )
                                                )}
                                            />
                                            {item.productName && item.quantity > item.stock && (
                                                <div className="flex items-center gap-1 mt-1 animate-pulse">
                                                    {item.stock <= 0 ? (
                                                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-destructive text-destructive font-bold bg-destructive/5 whitespace-nowrap">
                                                            OUT OF STOCK
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-orange-500 text-orange-600 font-bold bg-orange-50 whitespace-nowrap">
                                                            LOW STOCK: {item.stock}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-full md:w-32 space-y-2">
                                            <Label>Price</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={item.price}
                                                onChange={(e) => updateItem(item.id, 'price', e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                onBlur={(e) => {
                                                    if (e.target.value === "") updateItem(item.id, 'price', 0);
                                                }}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                className="bg-background"
                                            />
                                        </div>
                                        <div className="w-full md:w-32 space-y-2">
                                            <Label>Total</Label>
                                            <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-muted-foreground">
                                                {(item.price * item.quantity * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)).toFixed(2)}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:bg-destructive/10 mb-0.5"
                                            onClick={() => removeItem(item.id)}
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bottom Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            {companyDetails && (
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                    <h4 className="text-sm font-semibold mb-1">Billing From:</h4>
                                    <p className="text-sm font-bold">{companyDetails.companyName}</p>
                                    <p className="text-xs text-muted-foreground">{companyDetails.address}</p>
                                </div>
                            )}
                        </div>

                        {/* Right Column - Calculations */}
                        <div className="space-y-6 bg-muted/20 p-6 rounded-lg border">
                            <div className="flex justify-between items-center pb-2 border-b">
                                <div
                                    className="flex flex-col gap-1 cursor-pointer select-none"
                                    onDoubleClick={() => setIncludeGST(!includeGST)}
                                >
                                    <Label
                                        htmlFor="gst-toggle"
                                        className={`font-bold transition-colors duration-200 ${includeGST ? 'text-foreground' : 'text-white'}`}
                                    >
                                        Include GST (18%)
                                    </Label>
                                    <p className={`text-[10px] transition-colors duration-200 ${includeGST ? 'text-muted-foreground' : 'text-white'}`}>
                                        SGST+CGST
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold">Subtotal:</span>
                                <span className="text-muted-foreground">₹ {subtotal.toFixed(2)}</span>
                            </div>

                            {includeGST && (
                                <>
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                                        <span>CGST (9%):</span>
                                        <span>₹ {cgst.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                                        <span>SGST (9%):</span>
                                        <span>₹ {sgst.toFixed(2)}</span>
                                    </div>
                                </>
                            )}

                            {roundOff > 0 && (
                                <div className="flex justify-between items-center text-sm text-muted-foreground italic">
                                    <span>Round Off:</span>
                                    <span>+ ₹ {roundOff.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="loadingCharge" className="text-sm font-semibold">Loading Charges (Optional)</Label>
                                <Input
                                    id="loadingCharge"
                                    type="number"
                                    min="0"
                                    value={loadingCharge}
                                    onChange={(e) => setLoadingCharge(e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) as any)}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                        if (e.target.value === "") setLoadingCharge(0);
                                    }}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="bg-background"
                                />
                            </div>

                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>Grand Total:</span>
                                <span>₹ {grandTotal.toFixed(2)}</span>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Payment Method</Label>
                                <RadioGroup
                                    defaultValue="cash"
                                    value={paymentMethod}
                                    onValueChange={setPaymentMethod}
                                    className="flex gap-6 mt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="cash" id="cash" />
                                        <Label htmlFor="cash">Cash</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="online" id="online" />
                                        <Label htmlFor="online">Online</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="card" id="card" />
                                        <Label htmlFor="card">Bank</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        className="w-full py-6 text-lg mt-8"
                        size="lg"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Placing Order..." : "Place Order"}
                    </Button>

                </CardContent>
            </Card>

            {/* Dummy Orders History Section */}
            <div className="mt-12 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">Dummy Orders History</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="text-[10px] h-8 font-bold flex items-center gap-1"
                            onClick={handleClearHistory}
                            disabled={loadingOrders || dummyOrders.length === 0}
                        >
                            <Trash2 className="h-3 w-3" />
                            CLEAR ALL HISTORY
                        </Button>
                    </div>
                </div>
                <Card className="shadow-md">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-6 py-4">Order ID</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingOrders ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">Loading dummy orders...</TableCell>
                                    </TableRow>
                                ) : dummyOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">No dummy orders found</TableCell>
                                    </TableRow>
                                ) : (
                                    dummyOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium px-6">
                                                {`#${order.id ? order.id.substring(Math.max(0, order.id.length - 6)).toUpperCase() : "N/A"}`}
                                            </TableCell>
                                            <TableCell>{order.customer}</TableCell>
                                            <TableCell>
                                                {format(new Date(order.date), 'MMM dd, yyyy')}
                                            </TableCell>
                                            <TableCell>{order.itemsCount || 0} Items</TableCell>
                                            <TableCell>₹{(order.amount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex justify-end space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:bg-green-50"
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
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                        onClick={() => handleEditOrderDetail(order.id)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        disabled={deletingId === order.id}
                                                    >
                                                        {deletingId === order.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
};

export default DummyOrders;
