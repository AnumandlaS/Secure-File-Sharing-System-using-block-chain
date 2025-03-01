const express = require("express");
const AdminRoutes = require("./routes/AdminRoutes"); // Import the upload route
const LoginRoute = require("./routes/authRoutes");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve encrypted files if needed

// Get the MongoDB URI from the .env file
const uri = process.env.MONGODB_URI;
const connectToDB = async () => {
  try {
    await mongoose.connect(uri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Adjust as needed
      socketTimeoutMS: 45000, // Adjust as needed
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

//Start the server
(async () => {
  try {
    await connectToDB(); // Establish the MongoDB connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
  }
})();

// Routes
app.use("/api", AdminRoutes);
app.use("/api",LoginRoute)

