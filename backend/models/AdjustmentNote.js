const mongoose = require('mongoose');

const adjustmentNoteSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    noteNo: {
        type: String,
        required: true,
        unique: true
    },
    noteType: {
        type: String,
        enum: ['Credit', 'Debit'],
        required: true
    },
    originalOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    invoiceNo: {
        type: String,
        required: true
    },
    invoiceDate: {
        type: Date
    },
    customerName: {
        type: String,
        required: true
    },
    contact: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    // Business specific fields
    companyName: String,
    gstin: String,
    stateName: String,
    stateCode: String,
    email: String,
    
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            productName: String,
            quantity: Number,
            price: Number,
            unit: String,
            category: String,
            hsnCode: String,
            customFields: [
                {
                    label: String,
                    value: String,
                    unit: String
                }
            ],
            calculationField: {
                label: String,
                value: { type: String, default: "1" },
                unit: String
            }
        }
    ],
    subtotal: {
        type: Number,
        required: true
    },
    loadingCharge: {
        type: Number,
        default: 0
    },
    cgst: {
        type: Number,
        default: 0
    },
    sgst: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true
    },
    roundOff: {
        type: Number,
        default: 0
    },
    reason: {
        type: String,
        required: true
    },
    includeGST: {
        type: Boolean,
        default: true
    },
    isDummy: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AdjustmentNote', adjustmentNoteSchema);
