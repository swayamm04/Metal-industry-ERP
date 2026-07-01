const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
    grandTotal: {
        type: Number,
        required: true
    },
    roundOff: {
        type: Number,
        default: 0
    },
    paidAmount: {
        type: Number,
        required: true
    },
    balanceDue: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true
    },
    customerType: {
        type: String,
        enum: ['Individual', 'Business'],
        default: 'Individual'
    },
    // Business specific fields
    companyName: String,
    gstin: String,
    stateName: String,
    stateCode: String,
    email: String,
    // Delivery credentials
    invoiceNo: String,
    invoiceDate: Date,
    deliveryNote: String,
    modeOfPayment: String,
    referenceNo: String,
    otherReferences: String,
    buyersOrderNo: String,
    buyersOrderDate: Date,
    dispatchDocNo: String,
    deliveryNoteDate: Date,
    dispatchedThrough: String,
    destination: String,
    billOfLading: String,
    motorVehicleNo: String,
    termsOfDelivery: String,
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    previousStatus: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Completed']
    },
    paymentHistory: [
        {
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            method: { type: String, required: true }
        }
    ],
    includeGST: {
        type: Boolean,
        default: true
    },
    isDummy: {
        type: Boolean,
        default: false
    },
    isPastOrder: {
        type: Boolean,
        default: false
    },
    hasAdjustment: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
