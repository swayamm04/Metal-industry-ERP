"use client";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
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

const AdvanceOrder = () => {
    const [customerType, setCustomerType] = useState<"Individual" | "Business">("Individual");
    const [customerName, setCustomerName] = useState("");
    const [contact, setContact] = useState("");
    const [address, setAddress] = useState("");

    // Business specific state
    const [companyName, setCompanyName] = useState("");
    const [gstin, setGstin] = useState("");
    const [stateName, setStateName] = useState("");
    const [stateCode, setStateCode] = useState("");
    const [email, setEmail] = useState("");

    const getLocalDateString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Delivery Credentials state
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());
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
    const [paidAmount, setPaidAmount] = useState(0);
    const [includeGST, setIncludeGST] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);

    const [subtotal, setSubtotal] = useState(0);
    const [cgst, setCgst] = useState(0);
    const [sgst, setSgst] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [roundOff, setRoundOff] = useState(0);
    const [balanceDue, setBalanceDue] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const fetchNextInvoice = async () => {
            try {
                const today = getLocalDateString();
                const { data } = await api.get(`/api/orders/next-invoice-number?date=${today}`);
                setInvoiceNo(data.nextInvoiceNo);
                if (!invoiceDate) {
                    setInvoiceDate(today);
                }
            } catch (error) {
                console.error("Error fetching next invoice number:", error);
            }
        };

        if (!invoiceNo) {
            fetchNextInvoice();
        }
    }, [customerType]);

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

        setGrandTotal(Math.max(0, roundedTotal));
        setRoundOff(diff > 0 ? diff : 0);
        setCgst(individualGst);
        setSgst(individualGst);
        setBalanceDue(Math.max(0, roundedTotal - paidAmount));
    }, [items, loadingCharge, paidAmount, includeGST]);

    const addItem = () => {
        setItems([{ id: Date.now().toString(), productName: "", quantity: 1, price: 0, unit: "pcs", category: "", stock: 0 }, ...items]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: string, value: any) => {
        if (field === 'productName' && value) {
            const selectedProduct = availableProducts.find(p => p._id === value);
            if (selectedProduct) {
                // Find if this product (with same price and calculation) already exists in another row
                const existingItem = items.find(item =>
                    item.id !== id &&
                    item.productName === value &&
                    item.price === selectedProduct.price &&
                    (item.calculationField?.value === selectedProduct.calculationField?.value)
                );

                if (existingItem) {
                    const currentItem = items.find(item => item.id === id);
                    const currentQty = currentItem?.quantity || 1;

                    // Remove current row and update the existing one
                    setItems(prevItems => prevItems
                        .filter(item => item.id !== id)
                        .map(item => item.id === existingItem.id
                            ? { ...item, quantity: item.quantity + currentQty }
                            : item
                        )
                    );
                    toast.success(`Merged with existing ${selectedProduct.name}`);
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

    const handleSubmit = async () => {
        const isBusiness = customerType === "Business";
        const primaryName = isBusiness ? companyName : customerName;

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
                didDrawPage: undefined, // Fix for jsPDF types if needed, though usually not here
                subtotal,
                loadingCharge,
                cgst,
                sgst,
                grandTotal,
                roundOff,
                paidAmount,
                paymentMethod,
                balanceDue,
                companyDetails,
                customerType,
                companyName,
                gstin,
                stateName,
                stateCode,
                email,
                invoiceNo,
                invoiceDate,
                createdAt: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
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
                includeGST,
                status: 'Pending' // Always pending for Advance Orders
            };

            const response = await api.post("/api/orders", orderData);
            const createdOrder = response.data;
            
            await generateInvoicePDF({
                ...orderData,
                invoiceNo: createdOrder.invoiceNo,
                orderId: createdOrder._id
            });
            toast.success("Advance order placed and invoice generated!");

            // Reset form
            setCustomerName("");
            setContact("");
            setAddress("");
            setItems([]);
            setLoadingCharge(0);
            setPaidAmount(0);
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
            setInvoiceDate(getLocalDateString());

        } catch (error) {
            console.error("Error creating order:", error);
            toast.error("Failed to place order");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="-m-6 p-6 bg-indigo-50/50 dark:bg-indigo-950/10 min-h-screen">
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Advance Order</h1>
                        <p className="text-muted-foreground">Enter advance order details below. These orders will appear in Pending Orders first.</p>
                    </div>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:text-indigo-400 dark:border-indigo-900/50 uppercase tracking-wider px-3">
                        Advance Order Mode
                    </Badge>
                </div>

                <Card className="shadow-md border-indigo-100 dark:border-indigo-900/30">
                    <CardContent className="p-6 space-y-8">
                        <div className="flex flex-col space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-lg">Customer Type</Label>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="invoiceDate" className="text-sm font-semibold whitespace-nowrap text-muted-foreground">Order Date:</Label>
                                    <Input
                                        id="invoiceDate"
                                        type="date"
                                        value={invoiceDate}
                                        onChange={(e) => setInvoiceDate(e.target.value)}
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

                        <div className="space-y-6">
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
                                                <div className="w-full md:w-28 space-y-2">
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
                                                    ₹ {(item.price * item.quantity * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)).toFixed(2)}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                            <div className="space-y-4">
                                {companyDetails && (
                                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                        <h4 className="text-sm font-semibold mb-1">Billing From:</h4>
                                        <p className="text-sm font-bold">{companyDetails.companyName}</p>
                                        <p className="text-xs text-muted-foreground">{companyDetails.address}</p>
                                    </div>
                                )}
                            </div>

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
                                    <Label htmlFor="paidAmount" className="text-sm font-semibold">Paid Amount</Label>
                                    <Input
                                        id="paidAmount"
                                        type="number"
                                        min="0"
                                        value={paidAmount}
                                        onChange={(e) => {
                                            if (e.target.value === "") {
                                                setPaidAmount("" as any);
                                                return;
                                            }
                                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                                            setPaidAmount(Math.min(val, grandTotal));
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={(e) => {
                                            if (e.target.value === "") setPaidAmount(0);
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="bg-background"
                                    />
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

                                <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-md border border-destructive/20 text-destructive mt-4">
                                    <span className="font-bold">Balance Due:</span>
                                    <span className="font-bold text-lg">₹ {balanceDue.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            className="w-full py-6 text-lg mt-8"
                            size="lg"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Placing Advance Order..." : "Place Advance Order"}
                        </Button>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdvanceOrder;
