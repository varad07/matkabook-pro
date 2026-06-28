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

module.exports = { requireBoss, requireBroker };
