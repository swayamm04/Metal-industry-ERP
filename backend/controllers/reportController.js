const Order = require('../models/Order');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const ActivityLog = require('../models/ActivityLog');
const AdjustmentNote = require('../models/AdjustmentNote');

// Helper to build date filter
const buildDateFilter = (req) => {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }
    return filter;
};

// @desc    Get sales summary
// @route   GET /api/reports/sales/summary
// @access  Private
const getSalesSummary = async (req, res) => {
    try {
        const filter = buildDateFilter(req);
        const orderFilter = { ...filter, status: 'Completed', includeGST: { $ne: false } };
        const noteFilter = { ...filter, includeGST: { $ne: false }, originalOrder: { $exists: true, $ne: null } };

        const [orders, notes] = await Promise.all([
            Order.find(orderFilter).sort({ createdAt: 1 }),
            AdjustmentNote.find(noteFilter)
        ]);

        // Group by date (simplified for now)
        const summary = orders.reduce((acc, order) => {
            const date = new Date(order.createdAt).toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = { date, totalSales: 0, orderCount: 0 };
            }
            acc[date].totalSales += order.grandTotal;
            acc[date].orderCount += 1;
            return acc;
        }, {});

        notes.forEach(note => {
            const date = new Date(note.createdAt).toISOString().split('T')[0];
            if (!summary[date]) {
                summary[date] = { date, totalSales: 0, orderCount: 0 };
            }
            if (note.noteType === 'Credit') {
                summary[date].totalSales -= (note.grandTotal || 0);
            } else if (note.noteType === 'Debit') {
                summary[date].totalSales += (note.grandTotal || 0);
            }
        });

        res.status(200).json(Object.values(summary));
    } catch (error) {
        console.error('Error fetching sales summary:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get sales by category
// @route   GET /api/reports/sales/category
// @access  Private
const getCategorySales = async (req, res) => {
    try {
        const filter = buildDateFilter(req);
        filter.status = 'Completed';
        filter.includeGST = { $ne: false };

        const orders = await Order.find(filter);
        const categorySales = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                const category = item.category || 'Uncategorized';
                if (!categorySales[category]) {
                    categorySales[category] = 0;
                }
                categorySales[category] += (item.price * item.quantity);
            });
        });

        const result = Object.keys(categorySales).map(cat => ({
            category: cat,
            sales: categorySales[cat]
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching category sales:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get product stock report
// @route   GET /api/reports/inventory/products
// @access  Private
const getProductStockReport = async (req, res) => {
    try {
        const products = await Product.find().populate('category', 'name');
        const stockReport = products.map(p => ({
            name: p.name,
            category: p.category?.name || 'N/A',
            stock: p.stock,
            unit: p.unit,
            price: p.price,
            status: p.status,
            value: p.stock * p.price
        }));
        res.status(200).json(stockReport);
    } catch (error) {
        console.error('Error fetching product stock report:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get raw material stock report
// @route   GET /api/reports/inventory/raw-materials
// @access  Private
const getRawMaterialStockReport = async (req, res) => {
    try {
        const materials = await RawMaterial.find();
        const stockReport = materials.map(m => ({
            name: m.name,
            category: m.category,
            stock: m.stockQuantity,
            unit: m.unit,
            minLevel: m.minStockLevel
        }));
        res.status(200).json(stockReport);
    } catch (error) {
        console.error('Error fetching raw material stock report:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get order history
// @route   GET /api/reports/orders/history
// @access  Private
const getOrderHistory = async (req, res) => {
    try {
        const filter = buildDateFilter(req);
        filter.includeGST = { $ne: false };
        const orders = await Order.find(filter).sort({ createdAt: -1 });
        const report = orders.map(o => ({
            orderId: o._id,
            customer: o.customerName,
            date: new Date(o.createdAt).toISOString().split('T')[0],
            amount: o.grandTotal,
            status: o.status,
            paymentStatus: o.balanceDue === 0 ? 'Paid' : 'Partial'
        }));
        res.status(200).json(report);
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get pending orders
// @route   GET /api/reports/orders/pending
// @access  Private
const getPendingOrders = async (req, res) => {
    try {
        const filter = buildDateFilter(req);
        filter.status = 'Pending';
        filter.includeGST = { $ne: false };
        const orders = await Order.find(filter).sort({ createdAt: 1 });
        const report = orders.map(o => ({
            orderId: o._id,
            customer: o.customerName,
            date: new Date(o.createdAt).toISOString().split('T')[0],
            amount: o.grandTotal,
            items: o.items.length
        }));
        res.status(200).json(report);
    } catch (error) {
        console.error('Error fetching pending orders:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get top customers
// @route   GET /api/reports/customers/top
// @access  Private
const getTopCustomers = async (req, res) => {
    try {
        // Find customers, but we might want to filter their orders based on date
        // However, Customer model stores aggregates. 
        // For accurate date filtering, we should ideally aggregate from Orders.
        // For now, let's keep it simple and just return top customers as is, 
        // or effectively we have to aggregate orders.

        const { startDate, endDate } = req.query;
        let matchStage = {
            status: 'Completed',
            includeGST: { $ne: false }
        };

        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchStage.createdAt.$lte = end;
            }
        }

        const topCustomers = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$customerName", // Group by name since we might not have ID link for all
                    totalSpent: { $sum: "$grandTotal" },
                    orderCount: { $sum: 1 },
                    lastOrderDate: { $max: "$createdAt" }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 }
        ]);

        const report = topCustomers.map(c => ({
            name: c._id,
            orders: c.orderCount,
            spent: c.totalSpent,
            lastOrder: c.lastOrderDate ? new Date(c.lastOrderDate).toISOString().split('T')[0] : 'N/A'
        }));

        res.status(200).json(report);
    } catch (error) {
        console.error('Error fetching top customers:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get supplier performance (mock for now as data might be scarce)
// @route   GET /api/reports/suppliers/performance
// @access  Private
const getSupplierPerformance = async (req, res) => {
    try {
        const suppliers = await Supplier.find();
        // Since we don't have detailed performance metrics yet, we'll return basic info
        const report = suppliers.map(s => ({
            name: s.companyName,
            contact: s.contactPerson,
            email: s.email,
            status: s.status,
            productsSupplied: s.products
        }));
        res.status(200).json(report);
    } catch (error) {
        console.error('Error fetching supplier performance:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// ... (previous code)

// @desc    Get activity logs
// @route   GET /api/reports/activity-log
// @access  Private/SuperAdmin
const getActivityLogs = async (req, res) => {
    try {
        const filter = buildDateFilter(req);

        const logs = await ActivityLog.find(filter)
            .populate('user', 'name role email')
            .sort({ createdAt: -1 });

        const report = logs.map(log => ({
            timestamp: new Date(log.createdAt).toLocaleString(),
            user: log.user ? `${log.user.name} (${log.user.role})` : 'Unknown User',
            action: log.action,
            details: log.details,
            ip: log.ipAddress || 'N/A'
        }));

        res.status(200).json(report);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get dashboard analytics
// @route   GET /api/reports/analytics
// @access  Private
const getAnalyticsDashboard = async (req, res) => {
    try {
        const { period = 'year', startDate: customStart, endDate: customEnd } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        if (customStart || customEnd) {
            startDate = customStart ? new Date(customStart) : new Date(0);
            endDate = customEnd ? new Date(customEnd) : new Date();
            endDate.setHours(23, 59, 59, 999);

            const durationMs = endDate.getTime() - startDate.getTime();
            prevStartDate = new Date(startDate.getTime() - durationMs);
            prevEndDate = new Date(startDate.getTime());
        } else if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
            prevStartDate.setDate(prevStartDate.getDate() - 14);
            prevEndDate.setDate(prevEndDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
            prevStartDate.setMonth(prevStartDate.getMonth() - 2);
            prevEndDate.setMonth(prevEndDate.getMonth() - 1);
        } else if (period === 'quarter') {
            startDate.setMonth(startDate.getMonth() - 3);
            prevStartDate.setMonth(prevStartDate.getMonth() - 6);
            prevEndDate.setMonth(prevEndDate.getMonth() - 3);
        } else {
            startDate.setFullYear(startDate.getFullYear() - 1);
            prevStartDate.setFullYear(prevStartDate.getFullYear() - 2);
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        }

        const matchStage = {
            status: 'Completed',
            includeGST: { $ne: false },
            createdAt: { $gte: startDate, $lte: endDate }
        };

        const prevMatchStage = {
            status: 'Completed',
            includeGST: { $ne: false },
            createdAt: { $gte: prevStartDate, $lt: prevEndDate }
        };

        // Trend Grouping Logic
        const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const groupFormat = (period === 'week' || period === 'month' || (period === 'custom' && durationDays <= 31))
            ? { day: { $dayOfMonth: "$createdAt" }, month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }
            : { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } };

        // Monthly/Daily Trend
        const [kpis, prevKpis, trendData, categorySales, topProducts] = await Promise.all([
            // ... (keep previous aggregations the same)
            // Current KPI calculation
            Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$grandTotal" },
                        totalOrders: { $sum: 1 },
                        productsSold: { $sum: { $sum: "$items.quantity" } }
                    }
                }
            ]),
            // Previous KPI calculation
            Order.aggregate([
                { $match: prevMatchStage },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$grandTotal" },
                        totalOrders: { $sum: 1 },
                        productsSold: { $sum: { $sum: "$items.quantity" } }
                    }
                }
            ]),
            // Trend Data
            Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: groupFormat,
                        revenue: { $sum: "$grandTotal" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]),
            // Category Sales
            Order.aggregate([
                { $match: matchStage },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.category",
                        value: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                    }
                },
                { $sort: { value: -1 } }
            ]),
            // Top Products
            Order.aggregate([
                { $match: matchStage },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.productName",
                        sales: { $sum: "$items.quantity" },
                        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                    }
                },
                { $sort: { sales: -1 } },
                { $limit: 10 }
            ])
        ]);

        const [currentAdjustmentNotes, prevAdjustmentNotes] = await Promise.all([
            AdjustmentNote.find({
                includeGST: { $ne: false },
                createdAt: { $gte: startDate, $lte: endDate },
                originalOrder: { $exists: true, $ne: null }
            }),
            AdjustmentNote.find({
                includeGST: { $ne: false },
                createdAt: { $gte: prevStartDate, $lt: prevEndDate },
                originalOrder: { $exists: true, $ne: null }
            })
        ]);

        const customerCount = await Customer.countDocuments({ createdAt: { $gte: startDate } });
        const prevCustomerCount = await Customer.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate } });

        // Helper to calculate percentage change
        const calculateChange = (current, previous) => {
            if (!previous || previous === 0) return current > 0 ? "+100%" : "0%";
            const change = ((current - previous) / previous) * 100;
            return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
        };

        const currentKPIs = kpis[0] || { totalRevenue: 0, totalOrders: 0, productsSold: 0 };
        const pastKPIs = prevKpis[0] || { totalRevenue: 0, totalOrders: 0, productsSold: 0 };

        // Adjust Current KPIs
        const currentAdjRevenue = currentAdjustmentNotes.reduce((acc, note) => {
            return acc + (note.noteType === 'Debit' ? (note.grandTotal || 0) : -(note.grandTotal || 0));
        }, 0);
        const currentAdjQty = currentAdjustmentNotes.reduce((acc, note) => {
            const qtySum = note.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            return acc + (note.noteType === 'Debit' ? qtySum : -qtySum);
        }, 0);

        currentKPIs.totalRevenue += currentAdjRevenue;
        currentKPIs.productsSold += currentAdjQty;

        // Adjust Past KPIs
        const prevAdjRevenue = prevAdjustmentNotes.reduce((acc, note) => {
            return acc + (note.noteType === 'Debit' ? (note.grandTotal || 0) : -(note.grandTotal || 0));
        }, 0);
        const prevAdjQty = prevAdjustmentNotes.reduce((acc, note) => {
            const qtySum = note.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            return acc + (note.noteType === 'Debit' ? qtySum : -qtySum);
        }, 0);

        pastKPIs.totalRevenue += prevAdjRevenue;
        pastKPIs.productsSold += prevAdjQty;

        // Format Trends
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const formattedTrend = trendData.map(item => {
            let label = "";
            if (item._id.day) {
                const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                label = `${dayNames[date.getDay()]} ${item._id.day}`;
            } else {
                label = monthNames[item._id.month - 1];
            }
            return {
                label,
                revenue: item.revenue,
                orders: item.orders
            };
        });

        // Apply adjustments to trend
        currentAdjustmentNotes.forEach(note => {
            const date = new Date(note.createdAt);
            let label = "";
            if (groupFormat.day) {
                label = `${dayNames[date.getDay()]} ${date.getDate()}`;
            } else {
                label = monthNames[date.getMonth()];
            }
            
            const trendEntry = formattedTrend.find(t => t.label === label);
            if (trendEntry) {
                const amount = note.noteType === 'Debit' ? (note.grandTotal || 0) : -(note.grandTotal || 0);
                trendEntry.revenue += amount;
            }
        });

        res.status(200).json({
            kpis: {
                totalRevenue: currentKPIs.totalRevenue,
                totalRevenueChange: calculateChange(currentKPIs.totalRevenue, pastKPIs.totalRevenue),
                totalRevenueTrend: currentKPIs.totalRevenue >= pastKPIs.totalRevenue ? "up" : "down",

                totalOrders: currentKPIs.totalOrders,
                totalOrdersChange: calculateChange(currentKPIs.totalOrders, pastKPIs.totalOrders),
                totalOrdersTrend: currentKPIs.totalOrders >= pastKPIs.totalOrders ? "up" : "down",

                productsSold: currentKPIs.productsSold,
                productsSoldChange: calculateChange(currentKPIs.productsSold, pastKPIs.productsSold),
                productsSoldTrend: currentKPIs.productsSold >= pastKPIs.productsSold ? "up" : "down",

                newCustomers: customerCount,
                newCustomersChange: calculateChange(customerCount, prevCustomerCount),
                newCustomersTrend: customerCount >= prevCustomerCount ? "up" : "down"
            },
            monthlyTrend: formattedTrend,
            categorySales: categorySales.map(c => ({ name: c._id || 'Uncategorized', value: c.value })),
            topProducts: topProducts.map(p => ({ name: p._id, sales: p.sales, revenue: p.revenue, growth: 0 }))
        });
    } catch (error) {
        console.error('Error fetching dashboard analytics:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getSalesSummary,
    getCategorySales,
    getProductStockReport,
    getRawMaterialStockReport,
    getOrderHistory,
    getPendingOrders,
    getTopCustomers,
    getSupplierPerformance,
    getActivityLogs,
    getAnalyticsDashboard
};
