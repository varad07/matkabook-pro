function requireBoss(req, res, next) {
    if (req.user?.role !== 'boss')
        return res.status(403).json({ error: 'Boss access required' });
    next();
}

function requireBroker(req, res, next) {
    if (req.user?.role !== 'broker')
        return res.status(403).json({ error: 'Broker access required' });
    next();
}

function requireBossOrEmployee(req, res, next) {
    if (req.user?.role === 'boss' || req.user?.role === 'employee') return next();
    return res.status(403).json({ error: 'Access denied' });
}

function requireAnyRole(req, res, next) {
    if (['broker', 'boss', 'employee'].includes(req.user?.role)) return next();
    return res.status(403).json({ error: 'Access denied' });
}

module.exports = { requireBoss, requireBroker, requireBossOrEmployee, requireAnyRole };
