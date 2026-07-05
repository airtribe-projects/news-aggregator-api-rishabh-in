const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const port = 3000;
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || 'news-aggregator-dev-secret';
const newsApiKey = process.env.NEWS_API_KEY;
const users = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minPasswordLength = 6;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const validatePreferenceValue = (value, fieldName) => {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return `${fieldName} must include at least one value`;
        }

        if (!value.every(isNonEmptyString)) {
            return `${fieldName} must contain only non-empty strings`;
        }

        return null;
    }

    if (isNonEmptyString(value)) {
        return null;
    }

    return `${fieldName} must be a non-empty string or an array of strings`;
};

const validatePreferences = (preferences, options = {}) => {
    const { required = false } = options;

    if (preferences === undefined || preferences === null) {
        return required ? ['Preferences are required'] : [];
    }

    if (Array.isArray(preferences)) {
        const error = validatePreferenceValue(preferences, 'preferences');
        return error ? [error] : [];
    }

    if (isNonEmptyString(preferences)) {
        return [];
    }

    if (typeof preferences !== 'object') {
        return ['Preferences must be an array, object, or comma-separated string'];
    }

    const preferenceKeys = Object.keys(preferences);

    if (preferenceKeys.length === 0) {
        return required ? ['Preferences are required'] : [];
    }

    return preferenceKeys
        .map((key) => validatePreferenceValue(preferences[key], key))
        .filter(Boolean);
};

const validateRegistrationInput = ({ name, email, password, preferences }) => {
    const errors = [];

    if (!isNonEmptyString(name)) {
        errors.push('Name is required');
    }

    if (!isNonEmptyString(email)) {
        errors.push('Email is required');
    } else if (!emailPattern.test(email)) {
        errors.push('Email must be valid');
    }

    if (!isNonEmptyString(password)) {
        errors.push('Password is required');
    } else if (password.length < minPasswordLength) {
        errors.push(`Password must be at least ${minPasswordLength} characters long`);
    }

    return errors.concat(validatePreferences(preferences));
};

const registerUser = async (req, res) => {
    const { name, email, password, preferences = [] } = req.body;
    const errors = validateRegistrationInput(req.body);

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Invalid registration input', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (users.has(normalizedEmail)) {
        return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    users.set(normalizedEmail, {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        preferences
    });

    return res.status(200).json({ message: 'User registered successfully' });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!emailPattern.test(email)) {
        return res.status(400).json({ message: 'Email must be valid' });
    }

    const user = users.get(email.trim().toLowerCase());

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
    const [scheme, token] = authorizationHeader
        ? authorizationHeader.trim().split(/\s+/)
        : [];
    const bearerToken = scheme === 'Bearer'
        ? token
        : null;

    if (!bearerToken) {
        return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
        const decodedToken = jwt.verify(bearerToken, jwtSecret);
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
    const errors = validatePreferences(preferences, { required: true });

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Invalid preferences input', errors });
    }

    req.user.preferences = preferences;

    return res.status(200).json({ preferences: req.user.preferences });
};

const normalizePreferenceList = (value) => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
};

const buildNewsApiParams = (preferences) => {
    const categories = Array.isArray(preferences)
        ? preferences
        : normalizePreferenceList(
            typeof preferences === 'string'
                ? preferences
                : preferences.categories || preferences.category || preferences.topics
        );
    const languages = Array.isArray(preferences)
        ? []
        : normalizePreferenceList(
            typeof preferences === 'string'
                ? null
                : preferences.languages || preferences.language
        );

    return {
        q: categories.length > 0 ? categories.join(' OR ') : 'news',
        language: languages[0] || 'en',
        sortBy: 'publishedAt',
        pageSize: 20,
        apiKey: newsApiKey
    };
};

const getNews = async (req, res) => {
    if (!newsApiKey) {
        return res.status(200).json({
            news: [],
            message: 'NEWS_API_KEY is not configured'
        });
    }

    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: buildNewsApiParams(req.user.preferences),
            timeout: 10000
        });

        return res.status(200).json({ news: response.data.articles || [] });
    } catch (err) {
        if (err.response && err.response.status === 401) {
            return res.status(502).json({ message: 'News API authentication failed' });
        }

        if (err.response && err.response.status === 400) {
            return res.status(400).json({ message: 'Invalid news API request' });
        }

        return res.status(502).json({ message: 'Failed to fetch news articles' });
    }
};

app.post('/register', registerUser);
app.post('/login', loginUser);
app.post('/users/signup', registerUser);
app.post('/users/login', loginUser);
app.get('/preferences', authenticateToken, getPreferences);
app.put('/preferences', authenticateToken, updatePreferences);
app.get('/users/preferences', authenticateToken, getPreferences);
app.put('/users/preferences', authenticateToken, updatePreferences);
app.get('/news', authenticateToken, getNews);

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ message: 'Invalid JSON request body' });
    }

    return next(err);
});

app.use((err, req, res, next) => {
    return res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
    app.listen(port, (err) => {
        if (err) {
            return console.log('Something bad happened', err);
        }
        console.log(`Server is listening on ${port}`);
    });
}



module.exports = app;
