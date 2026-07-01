const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Customer = require('../models/Customer');
const AdjustmentNote = require('../models/AdjustmentNote');

// @desc    Get dashboard stats
// @route   GET /api/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
    try {
        const isSecret = req.query.secret === 'true';
        const filter = isSecret
            ? { includeGST: false }
            : { includeGST: { $ne: false } };

        const totalOrders = await Order.countDocuments({
            ...filter,
            status: { $ne: 'Cancelled' }
        });
        const totalActiveOrders = await Order.countDocuments({
            ...filter,
            status: { $nin: ['Completed', 'Cancelled'] }
        });

        // Calculate total revenue (only delivered/completed orders with specific filter)
        const orders = await Order.find({
            ...filter,
            status: 'Completed'
        });
        
        // Find adjustment notes matching the filter and apply to revenue (only order-linked notes)
        const notes = await AdjustmentNote.find({
            ...filter,
            originalOrder: { $exists: true, $ne: null }
        });
        const adjustmentTotal = notes.reduce((acc, note) => {
            if (note.noteType === 'Credit') {
                return acc - (note.grandTotal || 0);
            } else if (note.noteType === 'Debit') {
                return acc + (note.grandTotal || 0);
            }
            return acc;
        }, 0);

        const totalRevenue = orders.reduce((acc, order) => acc + (order.grandTotal || 0), 0) + adjustmentTotal;

        // Products and Customers remain global for now, but we could filter if needed
        const totalProducts = await Product.countDocuments();
        const activeCustomers = await Customer.countDocuments();

        const recentOrders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .limit(5);

        const formattedOrders = recentOrders.map(order => ({
            id: order._id,
            invoiceNo: order.invoiceNo,
            customer: order.customerName,
            items: order.items.length,
            amount: order.grandTotal || 0,
            status: order.status
        }));

        res.status(200).json({
            totalProducts,
            totalOrders,
            totalActiveOrders,
            totalRevenue,
            activeCustomers,
            recentOrders: formattedOrders
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getDashboardStats
};
