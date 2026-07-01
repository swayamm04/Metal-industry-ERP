const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/company-settings', require('./routes/companySettingsRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/estimations', require('./routes/estimationRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/raw-materials', require('./routes/rawMaterialRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/adjustment-notes', require('./routes/adjustmentNoteRoutes'));

// Database Connection
console.log('Attempting to connect to MongoDB...', process.env.MONGO_URI ? 'URI set' : 'URI MISSING');
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected successfully');
    })
    .catch((err) => {
        console.error('MongoDB Connection Error:', err.message);
    });

// Basic Route
app.get('/', (req, res) => {
    res.send('Metal Industry ERP Backend Running');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled API Error:', err);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on 0.0.0.0:${PORT}`);
    console.log('Health check available at /');
});

server.on('error', (err) => {
    console.error('Server startup error:', err);
});
