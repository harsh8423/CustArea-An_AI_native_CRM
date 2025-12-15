const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

/**
 * Connect to MongoDB
 */
async function connectMongoDB() {
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }

    try {
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(MONGODB_URI, options);
        isConnected = true;
        console.log('✓ MongoDB connected successfully');
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
            isConnected = false;
        });

    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}

/**
 * Close MongoDB connection
 */
async function closeMongoDB() {
    if (!isConnected) return;
    
    try {
        await mongoose.connection.close();
        isConnected = false;
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
}

/**
 * Check if MongoDB is connected
 */
function isMongoConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
    connectMongoDB,
    closeMongoDB,
    isMongoConnected,
    mongoose
};
