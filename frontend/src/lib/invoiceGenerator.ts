import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCalculationMultiplier } from './calculationUtils';

// Helper to load image
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            resolve('');
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

export interface InvoiceData {
    customerName: string;
    contact: string;
    address: string;
    items: any[];
    grandTotal: number;
    paymentMethod: string;
    customerType?: string;
    companyName?: string;
    gstin?: string;
    stateName?: string;
    stateCode?: string;
    email?: string;
    invoiceNo?: string;
    invoiceDate?: string | Date;
    deliveryNote?: string;
    modeOfPayment?: string;
    referenceNo?: string;
    otherReferences?: string;
    buyersOrderNo?: string;
    buyersOrderDate?: string | Date;
    dispatchDocNo?: string;
    deliveryNoteDate?: string | Date;
    dispatchedThrough?: string;
    destination?: string;
    billOfLading?: string;
    motorVehicleNo?: string;
    termsOfDelivery?: string;
    companyDetails?: {
        companyName: string;
        address: string;
        gstNumber?: string; // Fallback
        gstin?: string;     // Backend name
        stateName?: string; // Fallback
        state?: string;     // Backend name
        stateCode?: string; // Fallback
        gstCode?: string;   // Backend name
        phone: string;
        email: string;
        hsnCode?: string;
        bankDetails?: {
            accountHolderName?: string;
            bankName?: string;
            accountNumber?: string;
            ifscCode?: string;
            branch?: string;
            swiftCode?: string;
        };
    };
    orderId?: string;
    date?: string | Date;
    isEstimation?: boolean;
    estimationNo?: string;
    paidAmount?: number;
    balanceDue?: number;
    roundOff?: number;
    includeGST?: boolean;
    loadingCharge?: number;
    cgst?: number;
    sgst?: number;
    pageSize?: 'a4' | 'a5';
    status?: string;
}

export interface PaymentReceiptData {
    customerName: string;
    contact: string;
    address: string;
    orderId: string;
    paymentAmount: number;
    paymentDate: string | Date;
    paymentMethod: string;
    totalAmount: number;
    balanceDue: number;
    companyDetails?: InvoiceData['companyDetails'];
}

export interface StatementData {
    customerName: string;
    contact: string;
    address: string;
    orderId: string;
    totalAmount: number;
    paymentHistory: {
        amount: number;
        date: string | Date;
        method: string;
    }[];
    companyDetails?: InvoiceData['companyDetails'];
}

export interface AdjustmentNoteData {
    _id?: string;
    noteNo: string;
    noteType: 'Credit' | 'Debit';
    originalOrder?: string;
    invoiceNo: string;
    invoiceDate: string | Date;
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
    createdAt?: string | Date;
    companyDetails?: InvoiceData['companyDetails'];
}

export const generateInvoice = async (data: InvoiceData) => {
    const {
        customerName,
        contact,
        address,
        items,
        grandTotal,
        paymentMethod,
        companyDetails,
        orderId,
        date,
        customerType,
        companyName: businessCompanyName,
        gstin,
        stateName: buyerStateName,
        stateCode: buyerStateCode,
        email: buyerEmail,
        invoiceNo,
        invoiceDate: invDate,
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
        paidAmount,
        balanceDue,
        roundOff: passedRoundOff = 0,
        loadingCharge = 0,
        cgst: passedCgst,
        sgst: passedSgst,
        includeGST = true,
        pageSize = 'a4',
        status
    } = data;

    const orientation = pageSize === 'a5' ? 'l' : 'p'; // A5 landscape often used for bills, but let's stick to Portrait for A5 unless requested
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: pageSize
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper to format date
    const formatDate = (dateInput?: any) => {
        if (!dateInput) return "";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput.toString();
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    // Configuration for uniform page layout
    const drawPageDecoration = (tableData?: any) => {
        // Main Border for current page
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

        // Footer on every page
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("This is a Computer Generated Invoice", pageWidth / 2, pageHeight - 8, { align: "center" });

        if (tableData && tableData.pageNumber > 1) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${tableData.pageNumber}`, pageWidth - 15, pageHeight - 8);
        }
    };

    // Load Logo
    try {
        const logoBase64 = await loadImage("/logo.png");
        if (logoBase64) {
            // Add logo at top left: x=6, y=6, w=25, h=8 (keeping aspect ratio approx 3:1)
            doc.addImage(logoBase64, 'PNG', 6, 6, 25, 8);
        }
    } catch (error) {
        console.error("Error loading logo for invoice:", error);
    }

    // Header - Tax Invoice (First Page)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const isAdvanceOrPartial = (data.balanceDue ?? 0) > 0 && !data.isEstimation;
    const headerTitle = data.isEstimation ? "ESTIMATION" : (isAdvanceOrPartial ? "Advance Receipt" : (includeGST ? "Tax Invoice" : "Invoice/Bill"));
    doc.text(headerTitle, pageWidth / 2, 12, { align: "center" });
    doc.line(5, 15, pageWidth - 5, 15);

    // Top Section
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const leftCol = 8;
    doc.setFont("helvetica", "bold");
    doc.text(companyDetails?.companyName || "VASANTHA METAL INDUSTRY", leftCol, 20);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companyDetails?.address || "No 25/11, 2nd Main, 2nd Cross, Industrial Area, Bangalore", 80);
    doc.text(addressLines, leftCol, 25);

    let headerY = 25 + (addressLines.length * 4);
    const displayGstin = companyDetails?.gstin || (companyDetails as any)?.gstNumber || "";
    const displayStateName = companyDetails?.state || (companyDetails as any)?.stateName || "";
    const displayStateCode = companyDetails?.gstCode || (companyDetails as any)?.stateCode || "";

    doc.text(`GSTIN/UIN: ${displayGstin}`, leftCol, headerY);
    doc.text(`State Name: ${displayStateName}, Code: ${displayStateCode}`, leftCol, headerY + 5);

    // Top Section - Detailed Grid
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const rightColOffset = pageWidth / 2;

    // --- Right Column - Dynamic Row Rendering ---
    const rightColInternalSplit = 35; // The vertical split point within the right column area
    let currentRightY = 15;

    const renderHeaderRow = (leftPair?: { label: string, value: string }, rightPair?: { label: string, value: string }, fullWidth?: { label: string, value: string }) => {
        doc.setFontSize(8);
        const rowStartY = currentRightY;
        let rowHeight = 10; // Minimum row height

        if (fullWidth) {
            // Render full width row (e.g. Terms of Delivery)
            doc.setFont("helvetica", "normal");
            doc.text(fullWidth.label, rightColOffset + 2, rowStartY + 4);
            doc.setFont("helvetica", "bold");
            const wrapped = doc.splitTextToSize(fullWidth.value || "", (pageWidth - 5 - rightColOffset) - 4);
            doc.text(wrapped, rightColOffset + 2, rowStartY + 8);
            rowHeight = Math.max(rowHeight, 8 + (wrapped.length * 3.5));
        } else {
            // Render split row
            let leftHeight = 0;
            let rightHeight = 0;

            if (leftPair) {
                doc.setFont("helvetica", "normal");
                doc.text(leftPair.label, rightColOffset + 2, rowStartY + 4);
                doc.setFont("helvetica", "bold");
                const wrapped = doc.splitTextToSize(leftPair.value || "", rightColInternalSplit - 4);
                doc.text(wrapped, rightColOffset + 2, rowStartY + 8);
                leftHeight = 8 + (wrapped.length * 3.5);
            }

            if (rightPair) {
                doc.setFont("helvetica", "normal");
                doc.text(rightPair.label, rightColOffset + rightColInternalSplit + 2, rowStartY + 4);
                doc.setFont("helvetica", "bold");
                const wrapped = doc.splitTextToSize(rightPair.value || "", (pageWidth - 5 - (rightColOffset + rightColInternalSplit)) - 4);
                doc.text(wrapped, rightColOffset + rightColInternalSplit + 2, rowStartY + 8);
                rightHeight = 8 + (wrapped.length * 3.5);
            }
            rowHeight = Math.max(rowHeight, leftHeight, rightHeight);
        }

        // Draw Row Separators
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.line(rightColOffset, rowStartY + rowHeight, pageWidth - 5, rowStartY + rowHeight); // Horizontal line
        if (!fullWidth) {
            doc.line(rightColOffset + rightColInternalSplit, rowStartY, rightColOffset + rightColInternalSplit, rowStartY + rowHeight); // Internal vertical split
        }

        currentRightY += rowHeight;
    };

    // First row: Invoice No. and Dated
    renderHeaderRow(
        { label: data.isEstimation ? "Estimation No." : "Invoice No.", value: data.isEstimation ? (data.estimationNo || `EST-${Date.now().toString().slice(-6)}`) : (invoiceNo || "") },
        { label: "Dated", value: formatDate(invDate || date || new Date()) }
    );

    if (!data.isEstimation) {
        // Second row: Delivery Note and Mode/Terms of Payment
        renderHeaderRow(
            { label: "Delivery Note", value: deliveryNote || "" },
            { label: "Mode/Terms of Payment", value: (modeOfPayment || paymentMethod || "Cash").toUpperCase() }
        );

        // Third row: Dispatched through and Destination (LONG FIELD)
        renderHeaderRow(
            { label: "Dispatched through", value: dispatchedThrough || "" },
            { label: "Destination", value: destination || (address ? address.split(',').pop()?.trim() : "") || "N/A" }
        );

        // Fourth row: Delivery Note Date and Motor Vehicle No.
        renderHeaderRow(
            { label: "Delivery Note Date", value: formatDate(deliveryNoteDate) },
            { label: "Motor Vehicle No.", value: motorVehicleNo || "" }
        );

        // Fifth row: Terms of Delivery (Full width)
        renderHeaderRow(undefined, undefined, { label: "Terms of Delivery", value: termsOfDelivery || "" });
    }

    // Capture the final Y of the header section for the main split lines
    const headerEndX = pageWidth - 5;
    const headerEndY = currentRightY;

    // Reset some styles just in case
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(0);

    // Buyer Details
    doc.setFont("helvetica", "bold");
    doc.text("Buyer (Bill to)", leftCol, headerY + 15);

    let buyerY = headerY + 20;
    if (customerType === "Business" && businessCompanyName) {
        doc.text(businessCompanyName, leftCol, buyerY);
        buyerY += 4;
    } else {
        doc.text(customerName, leftCol, buyerY);
        buyerY += 4;
    }

    doc.setFont("helvetica", "normal");
    const buyerAddr = doc.splitTextToSize(address, 80);
    doc.text(buyerAddr, leftCol, buyerY);
    buyerY += (buyerAddr.length * 4);

    if (customerType === "Business") {
        if (gstin) {
            doc.text(`GSTIN/UIN: ${gstin}`, leftCol, buyerY);
            buyerY += 4;
        }
        if (buyerStateName) {
            doc.text(`State Name: ${buyerStateName}${buyerStateCode ? `, Code: ${buyerStateCode}` : ""}`, leftCol, buyerY);
            buyerY += 4;
        }
    }

    doc.text(`Contact: ${contact}`, leftCol, buyerY);

    const finalHeaderBottom = Math.max(85, headerEndY, buyerY + 5);

    doc.line(pageWidth / 2, 15, pageWidth / 2, finalHeaderBottom);
    doc.line(5, finalHeaderBottom, pageWidth - 5, finalHeaderBottom);

    // Items Table with Multi-page Support
    // Group identical products by name and price
    const mergedItemsMap = new Map<string, any>();

    // Reverse a shallow copy of items to ensure chronological order in the PDF
    const itemsToProcess = [...items].reverse();
    itemsToProcess.forEach(item => {
        const key = `${item.productName}_${item.price}_${item.unit || 'pcs'}`;
        const multiplier = getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit);
        const resultantQuantity = item.quantity * multiplier;

        if (mergedItemsMap.has(key)) {
            const existing = mergedItemsMap.get(key);
            existing.resultantQuantity += resultantQuantity;

            // Collect unique calculation info ONLY if it's length/feet related
            const label = item.calculationField?.label?.toLowerCase() || "";
            const isLengthRelated = label.includes("length") || label === "feet" || label === "ft";

            if (isLengthRelated && item.calculationField && item.calculationField.value && item.calculationField.value.toString() !== "1") {
                const info = `${item.calculationField.label}: ${item.calculationField.value} ${item.calculationField.unit || ""}`;
                if (!existing.allCalcInfo.includes(info)) {
                    existing.allCalcInfo.push(info);
                }
            }

            // Collect unique custom fields (specs)
            if (item.customFields) {
                item.customFields.forEach((f: any) => {
                    const fInfo = `${f.label}: ${f.value}${f.unit ? ` ${f.unit}` : ""}`;
                    if (!existing.allSpecs.includes(fInfo)) {
                        existing.allSpecs.push(fInfo);
                    }
                });
            }
        } else {
            const allSpecs = item.customFields
                ? item.customFields.map((f: any) => `${f.label}: ${f.value}${f.unit ? ` ${f.unit}` : ""}`)
                : [];

            const label = item.calculationField?.label?.toLowerCase() || "";
            const isLengthRelated = label.includes("length") || label === "feet" || label === "ft";

            const allCalcInfo = (isLengthRelated && item.calculationField && item.calculationField.value && item.calculationField.value.toString() !== "1")
                ? [`${item.calculationField.label}: ${item.calculationField.value} ${item.calculationField.unit || ""}`]
                : [];

            mergedItemsMap.set(key, {
                ...item,
                resultantQuantity,
                allSpecs,
                allCalcInfo
            });
        }
    });

    const tableBody = Array.from(mergedItemsMap.values()).map((item, index) => {
        const specsStr = item.allSpecs.length > 0 ? ` (${item.allSpecs.join(", ")})` : "";
        const calcStr = item.allCalcInfo.length > 0 ? ` (${item.allCalcInfo.join(", ")})` : "";

        const description = specsStr
            ? { content: `${item.productName || "Product"}${calcStr}\n${specsStr}`, styles: { fontSize: 8, cellPadding: 2 } }
            : `${item.productName || "Product"}${calcStr}`;

        // Determine the unit to display: calculation unit takes priority if it exists
        const displayUnit = (item.calculationField?.unit || item.unit || 'pcs').toUpperCase();

        return [
            index + 1,
            description,
            item.hsnCode || item.category || "N/A",
            `${item.resultantQuantity.toFixed(2)} ${displayUnit}`,
            item.price.toFixed(2),
            displayUnit,
            (item.price * item.resultantQuantity).toFixed(2)
        ];
    });

    const tableHead = [['SI No', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount']];

    autoTable(doc, {
        startY: finalHeaderBottom,
        head: tableHead,
        body: tableBody,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, font: "helvetica", lineWidth: 0.1, lineColor: [0, 0, 0] },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 15 },
            6: { cellWidth: 25, halign: 'right' }
        },
        margin: { left: 5, right: 5, bottom: 15 },
        didDrawPage: drawPageDecoration
    });

    // Summary Section
    let lastY = (doc as any).lastAutoTable.finalY + 5;
    const summaryHeight = 35;

    // Check if we need a new page for the summary
    if (lastY + summaryHeight > pageHeight - 15) {
        doc.addPage();
        drawPageDecoration();
        lastY = 20;
    }

    const summaryX = pageSize === 'a5' ? pageWidth - 100 : pageWidth - 80;
    const rightEdge = pageWidth - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const subtotalValue = items.reduce((sum, item) => sum + (item.price * item.quantity * getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit)), 0);
    const taxableValue = subtotalValue + loadingCharge;

    doc.text("Subtotal:", summaryX, lastY);
    doc.text(`Rs. ${subtotalValue.toFixed(2)}`, rightEdge, lastY, { align: 'right' });

    if (loadingCharge > 0) {
        doc.setFont("helvetica", "normal");
        doc.text("Loading Charges:", summaryX, lastY + 5);
        doc.text(`Rs. ${loadingCharge.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });
        lastY += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Total Taxable Value:", summaryX, lastY + 6);
    doc.text(`Rs. ${taxableValue.toFixed(2)}`, rightEdge, lastY + 6, { align: 'right' });
    lastY += 6;
    doc.setFont("helvetica", "normal");

    if (includeGST) {
        const cgst = passedCgst !== undefined ? passedCgst : (taxableValue * 0.09);
        const sgst = passedSgst !== undefined ? passedSgst : (taxableValue * 0.09);

        // In Add-On mode, we show taxes added specifically
        doc.setFont("helvetica", "normal");
        doc.text("CGST (9%):", summaryX, lastY + 5);
        doc.text(`Rs. ${cgst.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });

        doc.text("SGST (9%):", summaryX, lastY + 10);
        doc.text(`Rs. ${sgst.toFixed(2)}`, rightEdge, lastY + 10, { align: 'right' });
        lastY += 10;
    }

    if (passedRoundOff > 0) {
        doc.setFont("helvetica", "normal");
        doc.text("Round Off:", summaryX, lastY + 5);
        doc.text(`Rs. ${passedRoundOff.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });
        lastY += 5;
    }

    doc.line(summaryX - 2, lastY + 3, pageWidth - 5, lastY + 3);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", summaryX, lastY + 9);
    doc.text(`Rs. ${grandTotal.toFixed(2)}`, rightEdge, lastY + 9, { align: 'right' });

    // Payment Summary Section
    doc.setFontSize(9);
    if (balanceDue !== undefined && balanceDue > 0) {
        doc.text("Paid Amount:", summaryX, lastY + 16);
        doc.text(`Rs. ${paidAmount?.toFixed(2) || "0.00"}`, rightEdge, lastY + 16, { align: 'right' });

        doc.setTextColor(220, 38, 38); // Red for balance due
        doc.text("Balance Due:", summaryX, lastY + 22);
        doc.text(`Rs. ${balanceDue.toFixed(2)}`, rightEdge, lastY + 22, { align: 'right' });
        doc.setTextColor(0, 0, 0); // Reset to black
    }

    // New Footer Section
    let footerY = lastY + (balanceDue && balanceDue > 0 ? 25 : 20);
    const footerHeight = 45;

    // Check if footer fits on page
    if (footerY + footerHeight > pageHeight - 10) {
        doc.addPage();
        drawPageDecoration();
        footerY = 20;
    }

    // Amount in words (Spans across)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const amountInWords = `Amount in words : INR ${toWords(grandTotal).trim()} Only`;
    const wordsLines = doc.splitTextToSize(amountInWords, pageWidth - 15);
    doc.text(wordsLines, 7, footerY);
    footerY += (wordsLines.length * 4);

    // Footer Box
    const boxStartY = footerY + 2;
    const boxWidth = pageWidth - 10;
    const boxHeight = 48; // Increased box height for more signature space
    const splitX = 5 + (boxWidth * 0.55); // Vertical split line

    doc.setLineWidth(0.1);
    doc.rect(5, boxStartY, boxWidth, boxHeight);
    doc.line(splitX, boxStartY, splitX, boxStartY + boxHeight); // Middle vertical line

    // Declaration (Left Side)
    doc.setFontSize(7);
    const declTitle = "Declaration";
    doc.setFont("helvetica", "bold");
    doc.text(declTitle, 6, boxStartY + 4);
    doc.line(6, boxStartY + 4.5, 18, boxStartY + 4.5); // Underline declaration

    doc.setFont("helvetica", "normal");
    const declarationText = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
    const declLines = doc.splitTextToSize(declarationText, splitX - 10);
    doc.text(declLines, 6, boxStartY + 8);

    // Bank Details (Right Side - Top part)
    const rightX = splitX + 2;
    doc.setFont("helvetica", "bold");
    doc.text("Company's Bank Details", rightX, boxStartY + 4);

    doc.setFontSize(7);
    const bankDetails = companyDetails?.bankDetails;
    const bankData = [
        { label: "A/c Holder's Name", value: bankDetails?.accountHolderName || companyDetails?.companyName || "" },
        { label: "Bank Name", value: bankDetails?.bankName || "" },
        { label: "A/c No.", value: bankDetails?.accountNumber || "" },
        { label: "Branch & IFS Code", value: `${bankDetails?.branch || ""} & ${bankDetails?.ifscCode || ""}` },
        { label: "SWIFT Code", value: bankDetails?.swiftCode || "" }
    ];

    bankData.forEach((row, i) => {
        doc.setFont("helvetica", "normal");
        doc.text(row.label, rightX, boxStartY + 8 + (i * 3.5));
        doc.text(":", rightX + 24, boxStartY + 8 + (i * 3.5));
        doc.setFont("helvetica", "bold");
        doc.text(row.value.toString(), rightX + 26, boxStartY + 8 + (i * 3.5));
    });

    // Horizontal separator within right box (pushed down)
    doc.line(splitX, boxStartY + 28, pageWidth - 5, boxStartY + 28);

    // Signature Area (Bottom Right)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`for ${companyDetails?.companyName || "VASANTHA METAL INDUSTRY"}`, pageWidth - 7, boxStartY + 33, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Authorised Signatory", pageWidth - 10, boxStartY + 45, { align: "right" });

    if (status === "Cancelled") {
        const pageCount = doc.getNumberOfPages();
        const text = "CANCELLED";
        const fontSize = pageSize === 'a5' ? 75 : 100;
        
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 210, 210); // Soft light red/pink
        
        // Calculate text width in mm using scaleFactor
        const textWidth = (doc.getStringUnitWidth(text) * fontSize) / doc.internal.scaleFactor;
        
        const cx = pageWidth / 2;
        const cy = pageHeight / 2;
        
        // Compute the rotated start coordinates (bottom-left) so the text centers at (cx, cy)
        // With angle 45 (CCW rotation), the text direction is up-right:
        // dx = (textWidth / 2) * cos(45)
        // dy = -(textWidth / 2) * sin(45) (Y increases downwards, so going up is negative Y)
        const x = cx - (textWidth / 2) * 0.70711;
        const y = cy + (textWidth / 2) * 0.70711;
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(text, x, y, {
                angle: 45
            });
        }
    }

    doc.save(`${data.isEstimation ? 'Estimation' : 'Invoice'}_${customerName.replace(/\s+/g, '_')}_${orderId || Date.now()}.pdf`);
};

export const generateReceipt = async (data: PaymentReceiptData) => {
    const {
        customerName,
        contact,
        address,
        orderId,
        paymentAmount,
        paymentDate,
        paymentMethod,
        totalAmount,
        balanceDue,
        companyDetails
    } = data;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper to format date
    const formatDate = (dateInput?: any) => {
        if (!dateInput) return "";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput.toString();
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    // Load Logo
    try {
        const logoBase64 = await loadImage("/logo.png");
        if (logoBase64) {
            // Add logo at top left
            doc.addImage(logoBase64, 'PNG', 6, 6, 25, 8);
        }
    } catch (error) {
        console.error("Error loading logo for receipt:", error);
    }

    // Draw Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

    // Header - Payment Receipt
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT RECEIPT", pageWidth / 2, 12, { align: "center" });
    doc.line(5, 15, pageWidth - 5, 15);

    // Company Section (Header style)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(companyDetails?.companyName || "VASANTHA METAL INDUSTRY", 10, 22);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companyDetails?.address || "No 25/11, 2nd Main, 2nd Cross, Industrial Area, Bangalore", 80);
    doc.text(addressLines, 10, 27);

    // Receipt Info Section (Right side grid)
    doc.line(pageWidth / 2, 15, pageWidth / 2, 60);
    const rightCol = (pageWidth / 2) + 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Receipt Details:", rightCol, 22);
    doc.setFont("helvetica", "bold");
    doc.text(`Receipt No: RCT-${orderId.slice(-6).toUpperCase()}`, rightCol, 27);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDate(paymentDate)}`, rightCol, 32);
    doc.text(`Order Ref: #${orderId.slice(-6).toUpperCase()}`, rightCol, 37);

    doc.line(5, 60, pageWidth - 5, 60);

    // Customer Section
    doc.setFont("helvetica", "bold");
    doc.text("Received From:", 10, 70);
    doc.setFont("helvetica", "normal");
    doc.text(customerName, 10, 76);
    const buyerAddr = doc.splitTextToSize(address, 120);
    doc.text(buyerAddr, 10, 81);
    doc.text(`Contact: ${contact}`, 10, 81 + (buyerAddr.length * 5));

    // Payment Section
    doc.line(5, 100, pageWidth - 5, 100);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Information", pageWidth / 2, 110, { align: "center" });

    autoTable(doc, {
        startY: 115,
        head: [['Description', 'Details']],
        body: [
            ['Payment Method', paymentMethod.toUpperCase()],
            ['Paid Amount', `Rs. ${paymentAmount.toLocaleString()}`],
            ['Payment Date', formatDate(paymentDate)],
            ['Original Order Total', `Rs. ${totalAmount.toLocaleString()}`],
            ['Balance Due', `Rs. ${balanceDue.toLocaleString()}`]
        ],
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
        margin: { left: 10, right: 10 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 20;

    // Signatures
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Customer Signature", 30, finalY);
    doc.text("Authorized Signatory", pageWidth - 70, finalY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("This is a system generated payment receipt.", pageWidth / 2, pageHeight - 10, { align: "center" });

    doc.save(`Receipt_${customerName.replace(/\s+/g, '_')}_${orderId.slice(-6)}.pdf`);
};

export const generatePaymentStatement = async (data: StatementData) => {
    const {
        customerName,
        contact,
        address,
        orderId,
        totalAmount,
        paymentHistory,
        companyDetails
    } = data;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const formatDate = (dateInput?: any) => {
        if (!dateInput) return "";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput.toString();
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    // Load Logo
    try {
        const logoBase64 = await loadImage("/logo.png");
        if (logoBase64) {
            // Add logo at top left
            doc.addImage(logoBase64, 'PNG', 6, 6, 25, 8);
        }
    } catch (error) {
        console.error("Error loading logo for statement:", error);
    }

    // Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const headerTitle = "PAYMENT LEDGER / STATEMENT";
    doc.text(headerTitle, pageWidth / 2, 12, { align: "center" });
    doc.line(5, 15, pageWidth - 5, 15);

    // Company & Statement Info
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(companyDetails?.companyName || "VASANTHA METAL INDUSTRY", 10, 22);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companyDetails?.address || "Industrial Area, Bangalore", 80);
    doc.text(addressLines, 10, 27);

    const rightCol = pageWidth / 2 + 5;
    doc.line(pageWidth / 2, 15, pageWidth / 2, 60);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Statement Details:", rightCol, 22);
    doc.setFont("helvetica", "bold");
    doc.text(`Order ID: #${orderId.slice(-6).toUpperCase()}`, rightCol, 27);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDate(new Date())}`, rightCol, 32);
    doc.text(`Grand Total: Rs. ${totalAmount.toLocaleString()}`, rightCol, 37);

    doc.line(5, 60, pageWidth - 5, 60);

    // Customer
    doc.setFont("helvetica", "bold");
    doc.text("Customer:", 10, 70);
    doc.setFont("helvetica", "normal");
    doc.text(customerName, 10, 76);
    doc.text(contact, 10, 81);

    // Ledger Table
    let runningBalance = totalAmount;
    const ledgerEntries = paymentHistory
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((entry, idx) => {
            runningBalance -= entry.amount;
            return [
                idx + 1,
                formatDate(entry.date),
                `Payment ${idx + 1}`,
                entry.method.toUpperCase(),
                `Rs. ${entry.amount.toLocaleString()}`,
                `Rs. ${Math.max(0, runningBalance).toLocaleString()}`
            ];
        });

    autoTable(doc, {
        startY: 90,
        head: [['#', 'Date', 'Description', 'Method', 'Paid', 'Balance Due']],
        body: ledgerEntries,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: {
            fillColor: [44, 62, 80],
            textColor: [255, 255, 255],
            halign: 'left' // Default
        },
        columnStyles: {
            0: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'right' }
        },
        // Explicitly align specific header cells if needed, but columnStyles usually handles it.
        // Adding didParseCell for robustness in header alignment.
        didParseCell: (data) => {
            if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
                data.cell.styles.halign = 'right';
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Final Balance Due: Rs. ${Math.max(0, runningBalance).toLocaleString()}`, pageWidth - 10, finalY, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("End of Statement", pageWidth / 2, pageHeight - 10, { align: "center" });

    doc.save(`Statement_${customerName.replace(/\s+/g, '_')}_${orderId.slice(-6)}.pdf`);
};

export const generateAdjustmentNote = async (data: AdjustmentNoteData) => {
    const {
        noteNo,
        noteType,
        invoiceNo,
        invoiceDate,
        customerName,
        contact,
        address,
        companyName: businessCompanyName,
        gstin,
        stateName: buyerStateName,
        stateCode: buyerStateCode,
        items,
        subtotal,
        loadingCharge = 0,
        cgst = 0,
        sgst = 0,
        grandTotal,
        roundOff = 0,
        reason,
        includeGST = true,
        isDummy,
        createdAt,
        companyDetails
    } = data;

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper to format date
    const formatDate = (dateInput?: any) => {
        if (!dateInput) return "";
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput.toString();
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    const drawnWatermarkPages = new Set<number>();
    const drawPageDecoration = (tableData?: any) => {
        const currentPage = tableData ? tableData.pageNumber : 1;

        if (!drawnWatermarkPages.has(currentPage)) {
            drawnWatermarkPages.add(currentPage);
            // Draw Watermark first
            const watermarkText = `${noteType.toUpperCase()} NOTE`;
            doc.setFontSize(60);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(245, 245, 245); // extremely light gray (almost invisible behind text)
            const textWidth = (doc.getStringUnitWidth(watermarkText) * 60) / doc.internal.scaleFactor;
            const x = (pageWidth / 2) - (textWidth / 2) * 0.70711;
            const y = (pageHeight / 2) + (textWidth / 2) * 0.70711;
            doc.text(watermarkText, x, y, { angle: 45 });

            // Reset text color and drawing style
            doc.setTextColor(0);
            doc.setFont("helvetica", "normal");
        }

        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text(`This is a Computer Generated ${noteType} Note`, pageWidth / 2, pageHeight - 8, { align: "center" });

        if (tableData && tableData.pageNumber > 1) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${tableData.pageNumber}`, pageWidth - 15, pageHeight - 8);
        }
    };

    // Load Logo
    try {
        const logoBase64 = await loadImage("/logo.png");
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 6, 6, 25, 8);
        }
    } catch (error) {
        console.error("Error loading logo for adjustment note:", error);
    }

    // Title Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (noteType === 'Credit') {
        doc.setTextColor(180, 0, 0); // Burgundy/Red for credit
    } else {
        doc.setTextColor(0, 100, 0); // Dark green for debit
    }
    doc.text(`${noteType.toUpperCase()} NOTE`, pageWidth / 2, 12, { align: "center" });
    doc.setTextColor(0, 0, 0); // Reset to black
    doc.line(5, 15, pageWidth - 5, 15);

    // Company Block
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(companyDetails?.companyName || "VASANTHA METAL INDUSTRY", 8, 20);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companyDetails?.address || "Bangalore", 80);
    doc.text(addressLines, 8, 25);

    let headerY = 25 + (addressLines.length * 4);
    const displayGstin = companyDetails?.gstin || (companyDetails as any)?.gstNumber || "";
    const displayStateName = companyDetails?.state || (companyDetails as any)?.stateName || "";
    const displayStateCode = companyDetails?.gstCode || (companyDetails as any)?.stateCode || "";

    doc.text(`GSTIN/UIN: ${displayGstin}`, 8, headerY);
    doc.text(`State Name: ${displayStateName}, Code: ${displayStateCode}`, 8, headerY + 5);

    // Right Column Metadata grid
    const rightColOffset = pageWidth / 2;
    let currentRightY = 15;

    const renderHeaderRow = (leftPair?: { label: string, value: string }, rightPair?: { label: string, value: string }) => {
        doc.setFontSize(8);
        const rowStartY = currentRightY;
        let rowHeight = 10;
        
        let leftHeight = 0;
        let rightHeight = 0;
        const rightColInternalSplit = 35;

        if (leftPair) {
            doc.setFont("helvetica", "normal");
            doc.text(leftPair.label, rightColOffset + 2, rowStartY + 4);
            doc.setFont("helvetica", "bold");
            const wrapped = doc.splitTextToSize(leftPair.value || "", rightColInternalSplit - 4);
            doc.text(wrapped, rightColOffset + 2, rowStartY + 8);
            leftHeight = 8 + (wrapped.length * 3.5);
        }

        if (rightPair) {
            doc.setFont("helvetica", "normal");
            doc.text(rightPair.label, rightColOffset + rightColInternalSplit + 2, rowStartY + 4);
            doc.setFont("helvetica", "bold");
            const wrapped = doc.splitTextToSize(rightPair.value || "", (pageWidth - 5 - (rightColOffset + rightColInternalSplit)) - 4);
            doc.text(wrapped, rightColOffset + rightColInternalSplit + 2, rowStartY + 8);
            rightHeight = 8 + (wrapped.length * 3.5);
        }
        
        rowHeight = Math.max(rowHeight, leftHeight, rightHeight);

        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.line(rightColOffset, rowStartY + rowHeight, pageWidth - 5, rowStartY + rowHeight);
        doc.line(rightColOffset + rightColInternalSplit, rowStartY, rightColOffset + rightColInternalSplit, rowStartY + rowHeight);

        currentRightY += rowHeight;
    };

    renderHeaderRow(
        { label: `${noteType} Note No.`, value: noteNo },
        { label: "Dated", value: formatDate(createdAt || new Date()) }
    );
    renderHeaderRow(
        { label: "Original Invoice No.", value: invoiceNo },
        { label: "Original Invoice Date", value: formatDate(invoiceDate) }
    );
    
    // Add Reason row (spanning full width of right col)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Reason for Adjustment", rightColOffset + 2, currentRightY + 4);
    doc.setFont("helvetica", "bold");
    const wrappedReason = doc.splitTextToSize(reason || "Sales Return", (pageWidth - 5 - rightColOffset) - 4);
    doc.text(wrappedReason, rightColOffset + 2, currentRightY + 8);
    const reasonRowHeight = Math.max(10, 8 + (wrappedReason.length * 3.5));
    doc.line(rightColOffset, currentRightY + reasonRowHeight, pageWidth - 5, currentRightY + reasonRowHeight);
    currentRightY += reasonRowHeight;

    const finalHeaderBottom = Math.max(85, currentRightY, headerY + 15);

    // Buyer details
    doc.setFont("helvetica", "bold");
    doc.text("Bill To / Issued To", 8, headerY + 15);

    let buyerY = headerY + 20;
    if (businessCompanyName) {
        doc.text(businessCompanyName, 8, buyerY);
        buyerY += 4;
    } else {
        doc.text(customerName, 8, buyerY);
        buyerY += 4;
    }

    doc.setFont("helvetica", "normal");
    const buyerAddr = doc.splitTextToSize(address, 80);
    doc.text(buyerAddr, 8, buyerY);
    buyerY += (buyerAddr.length * 4);

    if (gstin) {
        doc.text(`GSTIN/UIN: ${gstin}`, 8, buyerY);
        buyerY += 4;
    }
    if (buyerStateName) {
        doc.text(`State Name: ${buyerStateName}${buyerStateCode ? `, Code: ${buyerStateCode}` : ""}`, 8, buyerY);
        buyerY += 4;
    }
    doc.text(`Contact: ${contact}`, 8, buyerY);

    const finalSectionDividerY = Math.max(finalHeaderBottom, buyerY + 5);
    doc.line(pageWidth / 2, 15, pageWidth / 2, finalSectionDividerY);
    doc.line(5, finalSectionDividerY, pageWidth - 5, finalSectionDividerY);

    // Table
    const tableBody = items.map((item, index) => {
        const displayUnit = (item.calculationField?.unit || item.unit || 'pcs').toUpperCase();
        const multiplier = getCalculationMultiplier(item.calculationField?.value, item.calculationField?.unit);
        const resultantQty = item.quantity * multiplier;
        const calcStr = (item.calculationField && item.calculationField.value && item.calculationField.value.toString() !== "1")
            ? ` (${item.calculationField.label}: ${item.calculationField.value} ${item.calculationField.unit || ""})`
            : "";

        return [
            index + 1,
            `${item.productName || "Product"}${calcStr}`,
            item.hsnCode || item.category || "N/A",
            `${resultantQty.toFixed(2)} ${displayUnit}`,
            item.price.toFixed(2),
            displayUnit,
            (item.price * resultantQty).toFixed(2)
        ];
    });

    const tableHead = [['SI No', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount']];

    autoTable(doc, {
        startY: finalSectionDividerY,
        head: tableHead,
        body: tableBody,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 2, font: "helvetica", lineWidth: 0.1, lineColor: [0, 0, 0] },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 15 },
            6: { cellWidth: 25, halign: 'right' }
        },
        margin: { left: 5, right: 5, bottom: 15 },
        willDrawPage: drawPageDecoration
    });

    // Summary
    let lastY = (doc as any).lastAutoTable.finalY + 5;
    const summaryHeight = 35;
    if (lastY + summaryHeight > pageHeight - 15) {
        doc.addPage();
        drawPageDecoration();
        lastY = 20;
    }

    const summaryX = pageWidth - 80;
    const rightEdge = pageWidth - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    doc.text("Subtotal:", summaryX, lastY);
    doc.text(`Rs. ${subtotal.toFixed(2)}`, rightEdge, lastY, { align: 'right' });

    if (loadingCharge > 0) {
        doc.text("Loading Charges:", summaryX, lastY + 5);
        doc.text(`Rs. ${loadingCharge.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });
        lastY += 5;
    }

    const taxableValue = subtotal + loadingCharge;
    doc.setFont("helvetica", "bold");
    doc.text("Total Taxable Value:", summaryX, lastY + 6);
    doc.text(`Rs. ${taxableValue.toFixed(2)}`, rightEdge, lastY + 6, { align: 'right' });
    lastY += 6;
    doc.setFont("helvetica", "normal");

    if (includeGST) {
        doc.text("CGST (9%):", summaryX, lastY + 5);
        doc.text(`Rs. ${cgst.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });

        doc.text("SGST (9%):", summaryX, lastY + 10);
        doc.text(`Rs. ${sgst.toFixed(2)}`, rightEdge, lastY + 10, { align: 'right' });
        lastY += 10;
    }

    if (roundOff > 0) {
        doc.text("Round Off:", summaryX, lastY + 5);
        doc.text(`Rs. ${roundOff.toFixed(2)}`, rightEdge, lastY + 5, { align: 'right' });
        lastY += 5;
    }

    doc.line(summaryX - 2, lastY + 3, pageWidth - 5, lastY + 3);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total Adjusted:", summaryX, lastY + 9);
    doc.text(`Rs. ${grandTotal.toFixed(2)}`, rightEdge, lastY + 9, { align: 'right' });

    // Footer box and signatures
    let footerY = lastY + 18;
    if (footerY + 55 > pageHeight - 10) {
        doc.addPage();
        drawPageDecoration();
        footerY = 20;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const amountInWords = `Amount in words : INR ${toWords(grandTotal).trim()} Only`;
    const wordsLines = doc.splitTextToSize(amountInWords, pageWidth - 15);
    doc.text(wordsLines, 7, footerY);
    footerY += (wordsLines.length * 4);

    const boxStartY = footerY + 2;
    const boxWidth = pageWidth - 10;
    const boxHeight = 50;
    const splitX = 5 + (boxWidth * 0.45);

    doc.rect(5, boxStartY, boxWidth, boxHeight);
    doc.line(splitX, boxStartY, splitX, boxStartY + boxHeight);

    // Left side info
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Declaration", 6, boxStartY + 4);
    doc.line(6, boxStartY + 4.5, 18, boxStartY + 4.5);
    doc.setFont("helvetica", "normal");
    const declText = `We declare that this ${noteType} Note shows the actual adjustment of the goods described and that all details are true and correct.`;
    const declLines = doc.splitTextToSize(declText, splitX - 10);
    doc.text(declLines, 6, boxStartY + 8);

    // Bank Details (Right Side - Top part)
    const rightX = splitX + 2;
    doc.setFont("helvetica", "bold");
    doc.text("Company's Bank Details", rightX, boxStartY + 4);

    doc.setFontSize(7);
    const bankDetails = companyDetails?.bankDetails;
    const bankData = [
        { label: "A/c Holder's Name", value: bankDetails?.accountHolderName || companyDetails?.companyName || "" },
        { label: "Bank Name", value: bankDetails?.bankName || "" },
        { label: "A/c No.", value: bankDetails?.accountNumber || "" },
        { label: "Branch & IFS Code", value: `${bankDetails?.branch || ""} & ${bankDetails?.ifscCode || ""}` },
        { label: "SWIFT Code", value: bankDetails?.swiftCode || "" }
    ];

    bankData.forEach((row, i) => {
        doc.setFont("helvetica", "normal");
        doc.text(row.label, rightX, boxStartY + 8 + (i * 3.5));
        doc.text(":", rightX + 24, boxStartY + 8 + (i * 3.5));
        doc.setFont("helvetica", "bold");
        doc.text(row.value.toString(), rightX + 26, boxStartY + 8 + (i * 3.5));
    });

    // Horizontal separator within right box (pushed down)
    doc.line(splitX, boxStartY + 28, pageWidth - 5, boxStartY + 28);

    // Signature Area (Bottom Right)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`for ${companyDetails?.companyName || "VASANTHA METAL INDUSTRY"}`, pageWidth - 7, boxStartY + 33, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Authorised Signatory", pageWidth - 10, boxStartY + 45, { align: "right" });

    doc.save(`${noteType}Note_${customerName.replace(/\s+/g, '_')}_${noteNo.replace(/\//g, '_')}.pdf`);
};

const toWords = (num: number) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

    const inWords = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + inWords(n % 10);
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
    };

    const whole = Math.floor(num);
    const fraction = Math.round((num - whole) * 100);

    let str = inWords(whole);
    if (fraction > 0) {
        str += 'and ' + inWords(fraction) + 'Paise ';
    }
    return str;
};

