const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");
const File=require("../models/FileSchema");
const User=require("../models/UserSchema");
require("dotenv").config();

const router = express.Router();

// Configure Multer for memory storage (no local file saving)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Cloud Storage
const storage = new Storage({ keyFilename: process.env.GOOGLE_CLOUD_KEYFILE });
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET);

// Static AES-256 Encryption Key (Use .env for security)
const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex") || crypto.randomBytes(32);

// Function to Encrypt File Data
function encryptBuffer(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { encryptedData: encrypted, iv: iv.toString("hex") };
}

router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });

        const { uploaderId } = req.body;  // Owner ID should be provided in request

        if (!uploaderId) return res.status(400).json({ error: "Uploader ID is required." });

        console.log(`Received file: ${req.file.originalname}`);

        // Encrypt file buffer
        const { encryptedData, iv } = encryptBuffer(req.file.buffer);

        // Define unique file name in GCS
        const fileName = `enc_${Date.now()}_${req.file.originalname}`;
        const file = bucket.file(fileName);

        // Upload encrypted file to GCS
        await file.save(encryptedData, { contentType: req.file.mimetype });

        console.log(`File uploaded to GCS: ${fileName}`);

        // Create File Metadata in MongoDB
        const newFile = new File({
            originalName: req.file.originalname,
            storedName: fileName,
            encryptionIV: iv,
            ownerId: uploaderId,  // Store the uploader as the owner
            sharedWith: [],  // Initially, file is not shared
            uploadTimestamp: new Date(),
            mimeType: req.file.mimetype,
            storageUrl: `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${fileName}`
        });

        await newFile.save();

        res.status(200).json({ 
            message: "File uploaded securely!", 
            fileId: newFile._id, 
            downloadUrl: newFile.storageUrl 
        });

    } catch (error) {
        console.error("File upload error:", error);
        res.status(500).json({ error: "Error uploading file.", details: error.message });
    }
});

router.post("/share", async (req, res) => {
    try {
        const { fileId, ownerId, sharedUserId } = req.body;

        // Validate request
        if (!fileId || !ownerId || !sharedUserId) {
            return res.status(400).json({ error: "fileId, ownerId, and sharedUserId are required." });
        }

        // Find the file
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ error: "File not found." });

        // Ensure the requester is the owner
        if (file.ownerId.toString() !== ownerId) {
            return res.status(403).json({ error: "Only the owner can share the file." });
        }

        // Add the user to sharedWith list if not already present
        if (!file.sharedWith.includes(sharedUserId)) {
            file.sharedWith.push(sharedUserId);
            await file.save();
        }
         // Update the file document to add shared user
         await File.findByIdAndUpdate(
            fileId,
            { $addToSet: { sharedWith: sharedUserId } }, // Prevents duplicate entries
            { new: true }
        );

        // Update the user document to add file reference
        await User.findByIdAndUpdate(
            sharedUserId,
            { $addToSet: { filesAccessed: fileId } }, // Adds fileId to filesAccessed array
            { new: true }
        );
        res.status(200).json({ message: "File shared successfully!", file });

    } catch (error) {
        console.error("File sharing error:", error);
        res.status(500).json({ error: "Error sharing file.", details: error.message });
    }
});

router.get("/download/:fileId/:userId", async (req, res) => {
    try {
        const { fileId, userId } = req.params;

        // Find the file
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ error: "File not found." });

        // Check if user is allowed to access the file
        if (file.ownerId.toString() !== userId && !file.sharedWith.includes(userId)) {
            return res.status(403).json({ error: "Access denied. You do not have permission to view this file." });
        }

        // Provide download URL
        res.status(200).json({ downloadUrl: file.storageUrl });

    } catch (error) {
        console.error("Download access error:", error);
        res.status(500).json({ error: "Error retrieving file.", details: error.message });
    }
});


module.exports = router;
