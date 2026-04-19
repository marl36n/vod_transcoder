const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Set static folder to public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', routes);

module.exports = app;
