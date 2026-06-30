require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const authRoutes        = require('./routes/auth');
const brokerRoutes      = require('./routes/brokers');
const marketRoutes      = require('./routes/markets');
const entryRoutes       = require('./routes/entries');
const resultRoutes      = require('./routes/results');
const settlementRoutes  = require('./routes/settlements');
const reportRoutes      = require('./routes/reports');
const searchRoutes      = require('./routes/search');
const auditRoutes       = require('./routes/audit');
const employeeRoutes    = require('./routes/employees');
const ratesRoutes       = require('./routes/rates');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/brokers',     brokerRoutes);
app.use('/api/markets',     marketRoutes);
app.use('/api/entries',     entryRoutes);
app.use('/api/results',     resultRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/reports',     reportRoutes);
app.use('/api/search',      searchRoutes);
app.use('/api/audit',       auditRoutes);
app.use('/api/employees',   employeeRoutes);
app.use('/api/rates',       ratesRoutes);

io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`MatkaBook Server running on port ${PORT}`);
});
