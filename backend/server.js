const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["chrome-extension://*", "http://localhost:5001"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
}));

// Update the MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MongoDB URI not found in environment variables');
    process.exit(1);
}

// MongoDB Connection with retry logic
async function connectWithRetry() {
    console.log('Attempting to connect to MongoDB...');
    
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
        });
        console.log('✅ MongoDB Connected Successfully');
        
        // Log the current collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
}

// Initial connection
connectWithRetry();

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    connectWithRetry();
});

// Schema
const LeetCodeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        required: true
    },
    problemId: {
        type: String,
        required: true
    },
    timeSpent: {
        type: Number,
        required: true
    },
    runtime: {
        type: String,
        default: 'N/A'
    },
    memory: {
        type: String,
        default: 'N/A'
    },
    status: {
        type: String,
        enum: ['Accepted'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    }
});

const LeetCodeModel = mongoose.model("LeetCodeSubmission", LeetCodeSchema);

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Update the submissions endpoint with better error handling
app.post("/api/submissions", async (req, res) => {
    try {
        console.log('📝 Received new submission:', req.body);
        
        const { 
            title, 
            difficulty, 
            problemId, 
            timeSpent, 
            runtime,
            memory,
            status,
            timestamp 
        } = req.body;
        
        if (!title || !problemId || timeSpent === 0) {
            console.log('❌ Invalid submission data received');
            return res.status(400).json({ 
                error: 'Invalid submission data',
                message: 'Title, problemId are required and timeSpent must be greater than 0'
            });
        }

        const newSubmission = new LeetCodeModel({
            title,
            difficulty: difficulty || 'Medium',
            problemId,
            timeSpent,
            runtime: runtime || 'N/A',
            memory: memory || 'N/A',
            status: status || 'Accepted',
            timestamp: new Date(timestamp)
        });

        const savedSubmission = await newSubmission.save();
        console.log('✅ Submission saved successfully:', savedSubmission);
        
        return res.status(201).json({ 
            message: "Submission Saved Successfully", 
            data: savedSubmission 
        });
    } catch (err) {
        console.error('❌ Error saving submission:', err);
        return res.status(500).json({ 
            error: 'Database Error',
            message: err.message 
        });
    }
});

// API Route to Get Submissions
app.get("/api/submissions", async (req, res) => {
    try {
        console.log('📊 Fetching submissions...');
        const submissions = await LeetCodeModel.find().sort({ timestamp: -1 });
        console.log(`✅ Found ${submissions.length} submissions`);
        res.json(submissions);
    } catch (err) {
        console.error('❌ Error fetching submissions:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`
🚀 Server running on port ${PORT}
📍 Endpoints:
   POST /api/submissions
   GET  /api/submissions
    `);
});

// Handle server shutdown
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    }
});