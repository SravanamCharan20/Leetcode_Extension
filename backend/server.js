const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./database");

// Connect to MongoDB
connectDB();

const app = express();
app.use(express.json());
app.use(cors({
    origin: "*",  
    methods: ["GET", "POST"], 
    allowedHeaders: ["Content-Type"]
}));

// Updated Schema with new fields
const LeetCodeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  submissionStatus: {
    type: String,
    enum: ['Accepted', 'Failed'],
    required: true
  },
  timeSpent: {
    type: Number,
    required: true
  },
  programmingLanguage: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
});

const LeetCodeModel = mongoose.model("LeetCodeActivity", LeetCodeSchema);

// API Route to Save LeetCode Activity
app.post("/api/leetcode", async (req, res) => {
  try {
    const { title, url, submissionStatus, timeSpent, programmingLanguage, timestamp } = req.body;
    
    const newEntry = new LeetCodeModel({
      title,
      url,
      submissionStatus,
      timeSpent,
      programmingLanguage,
      timestamp: new Date(timestamp)
    });

    await newEntry.save();
    res.status(201).json({ message: "Data Saved Successfully", data: newEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Route to Fetch Data with optional filters
app.get("/api/leetcode", async (req, res) => {
  try {
    const { status, language, startDate, endDate } = req.query;
    
    let query = {};
    
    if (status) {
      query.submissionStatus = status;
    }
    
    if (language) {
      query.programmingLanguage = language;
    }
    
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const data = await LeetCodeModel.find(query)
      .sort({ timestamp: -1 });
      
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));