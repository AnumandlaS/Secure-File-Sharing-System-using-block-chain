// const express = require("express");
// const multer = require("multer");
// const crypto = require("crypto");
// const fs = require("fs");
// const path = require("path");
// require("dotenv").config(); // Load environment variables

// const router = express.Router();

// // Ensure the uploads directory exists
// const uploadDir = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
// }

// // Configure Multer for file uploads
// const upload = multer({ dest: "uploads/" });

// // AES-256 Encryption Key (Should be stored securely!)
// const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex") || crypto.randomBytes(32);

// // Function to Encrypt File
// function encryptFile(filePath, outputFilePath) {
//     return new Promise((resolve, reject) => {
//         try {
//             const iv = crypto.randomBytes(16); // Initialization Vector
//             const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
//             const input = fs.createReadStream(filePath);
//             const output = fs.createWriteStream(outputFilePath);

//             input.pipe(cipher).pipe(output);

//             output.on("finish", () => {
//                 fs.unlinkSync(filePath); // Delete original file after encryption
//                 resolve(iv.toString("hex")); // Return IV for decryption later
//             });

//             output.on("error", reject);
//         } catch (error) {
//             reject(error);
//         }
//     });
// }

// // API Route for Secure File Upload
// router.post("/upload", upload.single("file"), async (req, res) => {
//     try {
//         if (!req.file) return res.status(400).send("No file uploaded.");

//         const filePath = req.file.path;
//         const encryptedPath = path.join("uploads", `enc_${req.file.filename}`);
        
//         // Encrypt file
//         const iv = encryptFile(filePath, encryptedPath);
        
//         // Save metadata (filename, IV, encrypted path) in database (MongoDB)
//         // Assume we have a File model: { filename, encryptedPath, iv, uploadedAt }
        
//         fs.unlinkSync(filePath); // Delete original file after encryption

//         res.status(200).json({ message: "File uploaded securely!", iv, encryptedPath });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error uploading file.");
//     }
// });

// module.exports = router;
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const upload = multer({ dest: uploadDir });

// Static AES-256 Encryption Key (Use .env for security)
const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex") || crypto.randomBytes(32);

// Function to Encrypt File
function encryptFile(filePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found: ${filePath}`));
        }

        const iv = crypto.randomBytes(16); // Initialization Vector
        const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(outputFilePath);

        input.pipe(cipher).pipe(output);

        output.on("finish", () => {
            if (fs.existsSync(filePath)) {
                console.log(`Deleting original file: ${filePath}`);
                fs.unlinkSync(filePath); // Delete original file only if it exists
            }
            resolve(iv.toString("hex")); // Return IV for decryption later
        });

        output.on("error", (err) => {
            console.error(`Encryption error for file: ${filePath}`, err);
            reject(err);
        });
    });
}

// API Route for Secure File Upload
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });

        const filePath = req.file.path;
        const encryptedPath = path.join(uploadDir, `enc_${req.file.filename}`);

        console.log(`Received file: ${filePath}`);
        console.log(`Encrypting to: ${encryptedPath}`);

        // Encrypt file
        const iv = await encryptFile(filePath, encryptedPath);

        res.status(200).json({ message: "File uploaded securely!", iv, encryptedPath });
    } catch (error) {
        console.error("File encryption error:", error);
        res.status(500).json({ error: "Error uploading file.", details: error.message });
    }
});

module.exports = router;
