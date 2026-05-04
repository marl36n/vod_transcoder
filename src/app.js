const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Set static folder to public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', routes);

module.exports = app;
