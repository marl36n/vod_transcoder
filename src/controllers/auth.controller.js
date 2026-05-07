const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const [rows] = await pool.query('SELECT u.*, ud.packager_service FROM users u LEFT JOIN user_details ud ON u.id = ud.user_id WHERE u.username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, packager_service: user.packager_service }, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production', { expiresIn: '24h' });
        
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true, message: 'Logged in successfully', user: { username: user.username, packager_service: user.packager_service } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
};

const me = (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ loggedIn: false });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production');
        res.json({ loggedIn: true, user: { username: decoded.username, packager_service: decoded.packager_service } });
    } catch (ex) {
        res.status(401).json({ loggedIn: false });
    }
};

module.exports = { login, logout, me };
