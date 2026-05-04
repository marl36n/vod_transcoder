require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setupDatabase() {
    console.log('Connecting to MySQL server...');
    try {
        // Connect without a specific database to create it if it doesn't exist
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            port: process.env.DB_PORT || 3306
        });

        const dbName = process.env.DB_NAME || 'vod_uploader_db';
        
        try {
            console.log(`Attempting to create database ${dbName} if it does not exist...`);
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        } catch (dbErr) {
            console.log(`Could not create database (might lack privileges or it already exists). Proceeding...`);
        }
        
        console.log(`Using database ${dbName}...`);
        await connection.query(`USE \`${dbName}\`;`);

        console.log('Creating users table if it does not exist...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check if admin user already exists
        const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', ['admin']);
        
        if (rows.length === 0) {
            console.log('Creating default admin user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);
            
            await connection.query(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                ['admin', hashedPassword]
            );
            console.log('Default user created successfully! Username: admin | Password: password123');
        } else {
            console.log('Default admin user already exists.');
        }

        console.log('Database setup completed successfully.');
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('Error during database setup:', error);
        process.exit(1);
    }
}

setupDatabase();
