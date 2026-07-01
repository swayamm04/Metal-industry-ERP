const AdjustmentNote = require('../models/AdjustmentNote');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Counter = require('../models/Counter');
const logActivity = require('../utils/activityLogger');

// Helper to update product stock for adjustment
const updateProductStockForAdjustment = async (items, noteType, isDummy) => {
    if (isDummy) return; // Skip stock adjustments for dummy orders/notes
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
        try {
            if (!item.productId) continue;
            const product = await Product.findById(item.productId);
            if (product) {
                // Credit Note (Sales Return): Add items back to stock
                // Debit Note: Deduct items from stock
                if (noteType === 'Credit') {
                    product.stock += (item.quantity || 0);
                } else if (noteType === 'Debit') {
                    product.stock -= (item.quantity || 0);
                }

                // Update product stock status
                if (product.stock <= 0) {
                    product.status = 'Out of Stock';
                } else if (product.stock <= 5) {
                    product.status = 'Low Stock';
                } else {
                    product.status = 'In Stock';
                }

                await product.save();
            }
        } catch (error) {
            console.error(`Error updating stock for adjustment product ${item.productId}:`, error);
        }
    }
};

// Helper to update customer spent totals
const updateCustomerStatsForAdjustment = async (contact, noteType, amount, isDummy) => {
    if (isDummy) return; // Skip updating customer statistics for dummy orders/notes
    try {
        const customer = await Customer.findOne({ contact });
        if (customer) {
            if (noteType === 'Credit') {
                customer.totalSpent = Math.max(0, customer.totalSpent - amount);
            } else if (noteType === 'Debit') {
                customer.totalSpent += amount;
            }
            await customer.save();
        }
    } catch (error) {
        console.error('Error updating customer statistics for adjustment:', error);
    }
};

// @desc    Create new Credit/Debit Note
// @route   POST /api/adjustment-notes
// @access  Private
const createAdjustmentNote = async (req, res) => {
    try {
        const {
            noteType,
            originalOrder,
            reason,
            items,
            subtotal,
            loadingCharge,
            cgst,
            sgst,
            grandTotal,
            roundOff
        } = req.body;

        if (!noteType || !reason || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing required fields or empty items list' });
        }

        let isDummy = false;
        let invoiceNo = req.body.invoiceNo || 'N/A';
        let invoiceDate = req.body.invoiceDate || new Date();
        let customerName = req.body.customerName;
        let contact = req.body.contact;
        let address = req.body.address;
        let companyName = req.body.companyName;
        let gstin = req.body.gstin;
        let stateName = req.body.stateName;
        let stateCode = req.body.stateCode;
        let email = req.body.email;
        let includeGST = req.body.includeGST !== false;
        let order;

        if (originalOrder) {
            order = await Order.findById(originalOrder);
            if (!order) {
                return res.status(404).json({ message: 'Original order not found' });
            }
            isDummy = order.isDummy || false;
            invoiceNo = order.invoiceNo;
            invoiceDate = order.createdAt;
            customerName = order.customerName;
            contact = order.contact;
            address = order.address;
            companyName = order.companyName;
            gstin = order.gstin;
            stateName = order.stateName;
            stateCode = order.stateCode;
            email = order.email;
            includeGST = order.includeGST;
        } else {
            isDummy = req.body.isDummy || false;
            if (!customerName || !contact || !address) {
                return res.status(400).json({ message: 'Customer/Party details (name, contact, address) are required for standalone notes' });
            }
        }

        // Generate note number sequentially
        let noteNo = '';
        try {
            const counterId = noteType === 'Credit' ? 'creditNote' : 'debitNote';
            const prefix = noteType === 'Credit' ? 'CN' : 'DN';
            
            const counter = await Counter.findOneAndUpdate(
                { id: counterId },
                { $inc: { seq: 1 } },
                { upsert: true, new: true }
            );
            
            noteNo = `${prefix}/${counter.seq}`;
        } catch (error) {
            console.error("Counter Error:", error);
            noteNo = `${noteType === 'Credit' ? 'CN' : 'DN'}/ERR-${Date.now()}`;
        }

        // Prepare adjustment data (inheriting metadata from original order or using manually entered info)
        const noteData = {
            user: req.user ? req.user._id : undefined,
            noteNo,
            noteType,
            originalOrder: originalOrder || undefined,
            invoiceNo,
            invoiceDate,
            customerName,
            contact,
            address,
            companyName,
            gstin,
            stateName,
            stateCode,
            email,
            items,
            subtotal,
            loadingCharge: loadingCharge || 0,
            cgst: cgst || 0,
            sgst: sgst || 0,
            grandTotal,
            roundOff: roundOff || 0,
            reason,
            includeGST,
            isDummy
        };

        const adjustmentNote = new AdjustmentNote(noteData);
        const createdNote = await adjustmentNote.save();

        // 1. Log Activity
        if (req.user && includeGST !== false) {
            await logActivity(
                req.user._id,
                'CREATED_ADJUSTMENT_NOTE',
                `Created ${noteType} Note #${noteNo} for Invoice #${invoiceNo || 'N/A'} (Customer: ${customerName})`,
                req
            );
        }

        // 2. Adjust Product Stock
        await updateProductStockForAdjustment(items, noteType, isDummy);

        // 3. Adjust Customer Spent
        await updateCustomerStatsForAdjustment(contact, noteType, grandTotal, isDummy);

        // 4. Update Original Order (Deduct or add to balance due, set hasAdjustment flag)
        if (originalOrder && order) {
            order.hasAdjustment = true;
            if (noteType === 'Credit') {
                order.balanceDue = Math.max(0, order.balanceDue - grandTotal);
            } else if (noteType === 'Debit') {
                order.balanceDue += grandTotal;
            }
            await order.save({ validateBeforeSave: false });
        }

        res.status(201).json(createdNote);
    } catch (error) {
        console.error('Error creating adjustment note:', error);
        res.status(500).json({ message: 'Failed to create adjustment note', error: error.message });
    }
};

// @desc    Get all adjustment notes
// @route   GET /api/adjustment-notes
// @access  Private
const getAdjustmentNotes = async (req, res) => {
    try {
        const isSecret = req.query.secret === 'true';
        // Filter by dummy/includeGST matching order pattern
        const filter = isSecret
            ? { includeGST: false }
            : { includeGST: { $ne: false } };

        const notes = await AdjustmentNote.find(filter).sort({ createdAt: -1 });
        res.status(200).json(notes);
    } catch (error) {
        console.error('Error fetching adjustment notes:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get adjustment note by ID
// @route   GET /api/adjustment-notes/:id
// @access  Private
const getAdjustmentNoteById = async (req, res) => {
    try {
        const note = await AdjustmentNote.findById(req.params.id);
        if (note) {
            res.status(200).json(note);
        } else {
            res.status(404).json({ message: 'Adjustment note not found' });
        }
    } catch (error) {
        console.error('Error fetching adjustment note by ID:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete adjustment note (with reverse updates)
// @route   DELETE /api/adjustment-notes/:id
// @access  Private
const deleteAdjustmentNote = async (req, res) => {
    try {
        const note = await AdjustmentNote.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ message: 'Adjustment note not found' });
        }

        // Reverse stock and customer changes (noteType reversed)
        const reverseType = note.noteType === 'Credit' ? 'Debit' : 'Credit';
        await updateProductStockForAdjustment(note.items, reverseType, note.isDummy);
        await updateCustomerStatsForAdjustment(note.contact, reverseType, note.grandTotal, note.isDummy);

        // Reverse order balance due changes and recalculate hasAdjustment flag
        if (note.originalOrder) {
            const order = await Order.findById(note.originalOrder);
            if (order) {
                if (note.noteType === 'Credit') {
                    order.balanceDue += note.grandTotal;
                } else if (note.noteType === 'Debit') {
                    order.balanceDue = Math.max(0, order.balanceDue - note.grandTotal);
                }

                const otherNotes = await AdjustmentNote.find({
                    originalOrder: note.originalOrder,
                    _id: { $ne: note._id }
                });
                order.hasAdjustment = otherNotes.length > 0;

                await order.save({ validateBeforeSave: false });
            }
        }

        await AdjustmentNote.deleteOne({ _id: note._id });

        // Log Activity
        if (req.user && note.includeGST !== false) {
            await logActivity(
                req.user._id,
                'DELETED_ADJUSTMENT_NOTE',
                `Deleted ${note.noteType} Note #${note.noteNo}`,
                req
            );
        }

        res.status(200).json({ message: 'Adjustment note removed' });
    } catch (error) {
        console.error('Error deleting adjustment note:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createAdjustmentNote,
    getAdjustmentNotes,
    getAdjustmentNoteById,
    deleteAdjustmentNote
};
