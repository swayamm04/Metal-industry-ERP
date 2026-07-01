"use client";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Check, ChevronsUpDown, FileText, Download, History as HistoryIcon, Lock } from "lucide-react";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { generateInvoice } from "@/lib/invoiceGenerator";
import { format } from "date-fns";
import { getCalculationMultiplier, isBase12Unit } from "@/lib/calculationUtils";

interface OrderItem {
    id: string;
    productName: string;
    quantity: number;
    price: number;
    category: string;
    unit: string;
    calculationField?: {
        label: string;
        value: string | number;
        unit: string;
    };
}

const Estimations = ({ isSecret = false }: { isSecret?: boolean }) => {
    const getLocalDateString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [createdAt, setCreatedAt] = useState(getLocalDateString());
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

    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
    const [companyDetails, setCompanyDetails] = useState<any>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loadingCharge, setLoadingCharge] = useState(0);
    const [includeGST, setIncludeGST] = useState(true);
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);

    const [subtotal, setSubtotal] = useState(0);
    const [cgst, setCgst] = useState(0);
    const [sgst, setSgst] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [roundOff, setRoundOff] = useState(0);

    const [estimationHistory, setEstimationHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
            const [productsRes, settingsRes, historyRes, customersRes] = await Promise.all([
                api.get("/api/products"),
                api.get("/api/company-settings"),
                api.get("/api/estimations"),
                api.get("/api/customers")
            ]);
            setAvailableProducts(productsRes.data);
            setCompanyDetails(settingsRes.data);
            setEstimationHistory(historyRes.data);
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
        const newSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.price * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)), 0);
        setSubtotal(newSubtotal);

        // Calculate grand total: Add-on GST if enabled
        const taxableValue = newSubtotal;
        const gstAmount = includeGST ? (taxableValue * 0.18) : 0;
        const individualGst = gstAmount / 2;
        const rawTotal = taxableValue + gstAmount + loadingCharge;

        // Round off logic: Round UP to nearest integer if there are decimals
        const roundedTotal = Math.ceil(rawTotal);
        const diff = Number((roundedTotal - rawTotal).toFixed(2));

        setGrandTotal(roundedTotal);
        setRoundOff(diff > 0 ? diff : 0);
        setCgst(individualGst);
        setSgst(individualGst);
    }, [items, loadingCharge, includeGST]);

    const addItem = () => {
        setItems([{ id: Date.now().toString(), productName: "", quantity: 1, price: 0, category: "", unit: "pcs" }, ...items]);
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
                        updatedItem.calculationField = product.calculationField;
                    }
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const handleGeneratePDF = async (est: any) => {
        await generateInvoice({
            ...est,
            isEstimation: true,
            companyDetails,
            pageSize: 'a4'
        });
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

    const handleSubmit = async () => {
        const isBusiness = customerType === "Business";
        const primaryName = isBusiness ? companyName : customerName;

        if (!primaryName || !address) {
            toast.error(`Please fill in required fields (${isBusiness ? "Company Name" : "Name"}, Address)`);
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

        setLoading(true);
        try {
            const formattedItems = items.map(item => {
                const product = availableProducts.find(p => p._id === item.productName);
                return {
                    ...item,
                    category: product ? (product.category?.name || "No Category") : item.category,
                    hsnCode: product?.category?.hsnCode || "",
                    productName: product ? product.name : item.productName,
                    customFields: product ? product.customFields : [],
                    calculationField: item.calculationField || product?.calculationField,
                    unit: item.unit || product?.unit || 'pcs'
                };
            });


            const estimationData = {
                customerName: isBusiness ? companyName : customerName,
                contact,
                address,
                items: formattedItems,
                subtotal,
                loadingCharge,
                grandTotal,
                roundOff,
                cgst,
                sgst,
                customerType,
                companyName,
                gstin,
                stateName,
                stateCode,
                email,
                includeGST,
                estimationNo: `EST-${Date.now().toString().slice(-6)}`,
                date: createdAt ? new Date(createdAt).toISOString() : undefined,
                createdAt: createdAt ? new Date(createdAt).toISOString() : undefined
            };

            const response = await api.post("/api/estimations", estimationData);

            // Auto download PDF
            await handleGeneratePDF(response.data);

            toast.success("Estimation created and downloaded!");

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
            setCreatedAt(getLocalDateString());

            // Refresh history
            fetchData();

        } catch (error) {
            console.error("Error creating estimation:", error);
            toast.error("Failed to create estimation");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {!isSecret && (
                <div>
                    <h1 className="text-2xl font-bold">Price Estimations</h1>
                    <p className="text-muted-foreground">Create and manage price quotes for customers.</p>
                </div>
            )}

            {!isSecret && (
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            New Estimation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        {/* Creation form content remains here... */}
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
                                            <PopoverContent className="w-[300px] p-1 shadow-lg border-muted-foreground/20" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                                            <PopoverContent className="w-[300px] p-1 shadow-lg border-muted-foreground/20" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                                        onChange={(e) => setContact(e.target.value)}
                                        placeholder="Phone number"
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

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Estimation Items</h3>
                                <Button onClick={addItem} variant="outline" size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                            </div>

                            <div className="border rounded-md p-4 bg-muted/20 space-y-4">
                                {items.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-4">No items added.</p>
                                ) : (
                                    items.map((item) => (
                                        <div key={item.id} className="flex flex-col md:flex-row gap-4 items-end border-b pb-4 last:border-0 last:pb-0">
                                            <div className="flex-1 space-y-2 w-full">
                                                <Label className="text-xs font-semibold">Product</Label>
                                                <Popover open={openPopoverId === item.id} onOpenChange={(open) => setOpenPopoverId(open ? item.id : null)}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between bg-background border-input text-left font-normal h-10 px-3"
                                                        >
                                                            <span className="truncate">
                                                                {item.productName
                                                                    ? availableProducts.find((p) => p._id === item.productName)?.name
                                                                    : "Select Product..."}
                                                            </span>
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[400px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search Product..." />
                                                            <CommandList>
                                                                <CommandEmpty>No product found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {availableProducts.map((p) => (
                                                                        <CommandItem
                                                                            key={p._id}
                                                                            value={`${p.name} ${p.category?.name || ""} ${p.customFields?.filter((f: any) => f.value && f.value.toString().trim() !== "").map((f: any) => f.value).join(" ")}`.trim()}
                                                                            onSelect={() => {
                                                                                updateItem(item.id, 'productName', p._id);
                                                                                setOpenPopoverId(null);
                                                                            }}
                                                                            className="group cursor-pointer transition-colors data-[selected=true]:bg-slate-100 hover:bg-blue-600"
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    item.productName === p._id ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            <div className="flex flex-col">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-bold text-foreground group-data-[selected=true]:text-foreground group-hover:text-white transition-colors">{p.name}</span>
                                                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-muted-foreground/30 text-muted-foreground group-data-[selected=true]:text-foreground group-data-[selected=true]:border-foreground/20 group-hover:border-white group-hover:text-white uppercase transition-colors">
                                                                                        {p.unit || 'pcs'}
                                                                                    </Badge>
                                                                                </div>
                                                                                <span className="text-xs text-muted-foreground group-data-[selected=true]:text-muted-foreground group-hover:text-white transition-colors">
                                                                                    Price: ₹{p.price} | Category: <span className="font-semibold group-data-[selected=true]:text-foreground group-hover:text-white">{p.category?.name || "No Category"}</span>
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
                                                <Label className="text-xs font-semibold">Qty</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={(e) => {
                                                        if (e.target.value === "") updateItem(item.id, 'quantity', 1);
                                                    }}
                                                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value === "" ? "" : parseFloat(e.target.value) || 1)}
                                                />
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <Label className="text-xs font-semibold">Price</Label>
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
                                                <Label className="text-xs font-semibold">Total</Label>
                                                <div className="h-10 flex items-center px-3 border rounded-md bg-muted font-medium">
                                                    ₹ {(item.price * item.quantity * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)).toFixed(2)}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Bottom Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4 border-t">
                            {/* Left Column - Billing From */}
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
                            <div className="w-full space-y-4 bg-muted/20 p-6 rounded-lg border">
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
                                    <span className="font-semibold text-muted-foreground">Subtotal:</span>
                                    <span>₹ {subtotal.toFixed(2)}</span>
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

                                <div className="flex items-center gap-4">
                                    <Label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Loading Charges:</Label>
                                    <Input
                                        type="number"
                                        value={loadingCharge}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={(e) => {
                                            if (e.target.value === "") setLoadingCharge(0);
                                        }}
                                        onChange={(e) => setLoadingCharge(e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) as any)}
                                        className="h-8 bg-background"
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xl font-bold border-t pt-4">
                                    <span>Grand Total:</span>
                                    <span className="text-primary">₹ {grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            className="w-full py-6 text-lg"
                            size="lg"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create & Download Estimation"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Estimation History Table */}
            <Card className="shadow-md border border-muted/20 bg-white">
                {!isSecret && (
                    <CardHeader className="bg-primary/5">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <HistoryIcon className="h-5 w-5 text-primary" />
                            Estimation History
                        </CardTitle>
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[600px] md:min-w-full">
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[120px] whitespace-nowrap">Estimation #</TableHead>
                                    <TableHead className="w-[120px] whitespace-nowrap">Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {estimationHistory.filter(est => isSecret ? !est.includeGST : est.includeGST).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No {isSecret ? "secret" : ""} estimations found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    estimationHistory
                                        .filter(est => isSecret ? !est.includeGST : est.includeGST)
                                        .map((est) => (
                                            <TableRow key={est._id} className="hover:bg-zinc-50 transition-colors">
                                                <TableCell className="font-medium text-zinc-900 uppercase tracking-tighter text-xs sm:text-sm">
                                                    #{est.estimationNo || "N/A"}
                                                </TableCell>
                                                <TableCell className="font-normal text-zinc-600 text-xs sm:text-sm whitespace-nowrap">
                                                    {format(new Date(est.createdAt), "dd MMM yyyy")}
                                                </TableCell>
                                                <TableCell className="text-zinc-700 text-xs sm:text-sm">{est.customerName}</TableCell>
                                                <TableCell className="text-zinc-500 text-xs sm:text-sm">{est.items.length} Items</TableCell>
                                                <TableCell className="text-right text-zinc-900 text-xs sm:text-sm">
                                                    ₹ {est.grandTotal.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="flex items-center gap-1 mx-auto transition-all duration-200 text-zinc-900 hover:bg-blue-600 hover:text-white"
                                                        onClick={() => handleGeneratePDF(est)}
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        <span className="text-xs">PDF</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Estimations;
