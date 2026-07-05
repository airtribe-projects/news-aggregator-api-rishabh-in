const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || 'news-aggregator-dev-secret';
const users = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const registerUser = async (req, res) => {
    const { name, email, password, preferences = [] } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (users.has(email)) {
        return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    users.set(email, {
        name,
        email,
        passwordHash,
        preferences
    });

    return res.status(200).json({ message: 'User registered successfully' });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = users.get(email);

    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '1h' });

    return res.status(200).json({ token });
};

const authenticateToken = (req, res, next) => {
    const authorizationHeader = req.headers.authorization;
    const token = authorizationHeader && authorizationHeader.split(' ')[0] === 'Bearer'
        ? authorizationHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
        const decodedToken = jwt.verify(token, jwtSecret);
        const user = users.get(decodedToken.email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user;
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const getPreferences = (req, res) => {
    return res.status(200).json({ preferences: req.user.preferences });
};

const updatePreferences = (req, res) => {
    const preferences = Object.prototype.hasOwnProperty.call(req.body, 'preferences')
        ? req.body.preferences
        : req.body;

    if (!preferences || (typeof preferences === 'object' && !Array.isArray(preferences) && Object.keys(preferences).length === 0)) {
        return res.status(400).json({ message: 'Preferences are required' });
    }

    req.user.preferences = preferences;

    return res.status(200).json({ preferences: req.user.preferences });
};

app.post('/register', registerUser);
app.post('/login', loginUser);
app.post('/users/signup', registerUser);
app.post('/users/login', loginUser);
app.get('/preferences', authenticateToken, getPreferences);
app.put('/preferences', authenticateToken, updatePreferences);
app.get('/users/preferences', authenticateToken, getPreferences);
app.put('/users/preferences', authenticateToken, updatePreferences);

if (require.main === module) {
    app.listen(port, (err) => {
        if (err) {
            return console.log('Something bad happened', err);
        }
        console.log(`Server is listening on ${port}`);
    });
}



module.exports = app;
