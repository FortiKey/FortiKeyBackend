require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { connectDB } = require('../config/db');

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check if an admin user already exists
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });

    // If an admin user already exists, log a message and return
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create a new admin user
    const adminUser = new User({
      company: 'FortiKey Admin',
      firstName: 'Admin',
      lastName: 'User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });

    // Save the new admin user
    await adminUser.save();
    console.log('Admin user created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdmin();