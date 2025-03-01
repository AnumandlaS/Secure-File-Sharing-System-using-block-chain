const express = require("express");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");
const Blockchain = require("../blockchain_modules/blockchain");
const File = require("../models/FileSchema");
const User = require("../models/UserSchema");
require("dotenv").config();

const router = express.Router();
const blockchain = new Blockchain();

// Configure Multer for memory storage (Google Cloud does not require local storage)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Cloud Storage
const storage = new Storage({ keyFilename: process.env.GOOGLE_CLOUD_KEYFILE });
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET);

// Static AES-256 Encryption Key
const SECRET_KEY =
  Buffer.from(process.env.ENCRYPTION_KEY, "hex") || crypto.randomBytes(32);

// Function to Encrypt File Data
function encryptBuffer(buffer) {
  console.log(
    "🔹 First 20 Bytes Before Encryption:",
    buffer.slice(0, 20).toString("hex")
  ); // Debug
  const iv = crypto.randomBytes(16);
  // console.log(`🔹 Encryption IV: ${iv.toString("hex")}`); // Log IV
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
  cipher.setAutoPadding(true); // ✅ Ensure correct padding is used
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encryptedData: encrypted, iv: iv.toString("hex") };
}

// Helper function to generate SHA-256 hash of a file buffer
function computeFileHash(buffer) {
  console.log(
    "🔹 First 20 Bytes Before Hashing:",
    buffer.slice(0, 20).toString("hex")
  ); // Debug
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// 📌 1️⃣ **Upload & Secure File (Google Cloud + Blockchain)**
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const { uploaderId } = req.body; // Owner ID should be provided in request
    if (!uploaderId)
      return res.status(400).json({ error: "Uploader ID is required." });

    console.log(`Received file: ${req.file.originalname}`);

    // 🔹 Encrypt file buffer
    // const { encryptedData, iv } = encryptBuffer(req.file.buffer);

    console.log(
      "🔹 First 20 Bytes of Original File Buffer:",
      req.file.buffer.slice(0, 20).toString("hex")
    );

    // 🔹 Compute SHA-256 hash for integrity check
    // const fileHash = computeFileHash(encryptedData);
    const fileHash = computeFileHash(req.file.buffer); // ✅ Hashing before encryption
    const { encryptedData, iv } = encryptBuffer(req.file.buffer);

    console.log(`🔹 Original File Buffer Length: ${req.file.buffer.length}`);
    console.log(
      `🔹 Encrypted File Buffer Length Before Upload: ${encryptedData.length}`
    );
    console.log(`🔹 Hash Computed Before Upload: ${fileHash}`);

    // 🔹 Store hash in blockchain (FIXED: Added `await`)
    const newBlock = await blockchain.addBlock(fileHash);
    console.log(`Blockchain block added: ${newBlock.currentHash}`);

    // 🔹 Define unique file name in GCS
    const fileName = `enc_${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    // 🔹 Upload encrypted file to Google Cloud Storage
    await file.save(encryptedData, { contentType: req.file.mimetype });

    console.log(`File uploaded to GCS: ${fileName}`);

    // 🔹 Store file hash in blockchain
    // blockchain.addBlock(fileHash);

    // 🔹 Create File Metadata in MongoDB
    const newFile = new File({
      originalName: req.file.originalname,
      storedName: fileName,
      encryptionIV: iv,
      ownerId: uploaderId,
      sharedWith: [],
      uploadTimestamp: new Date(),
      mimeType: req.file.mimetype,
      storageUrl: `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${fileName}`,
      // blockchainHash: newBlock.currentHash,
      blockchainHash: newBlock.fileHash,
    });

    await newFile.save();
    console.log("✅ File metadata saved in MongoDB:", newFile);

    res.status(200).json({
      message: "File uploaded securely!",
      fileId: newFile._id,
      downloadUrl: newFile.storageUrl,
      blockchainHash: newBlock.fileHash, // ✅ Store the actual file hash
      // blockchainHash: newBlock.currentHash, // Return stored blockchain hash for verification
    });
  } catch (error) {
    console.error("File upload error:", error);
    res
      .status(500)
      .json({ error: "Error uploading file.", details: error.message });
  }
});

// 📌 2️⃣ **Verify File Integrity Using Blockchain**
// router.post("/verify", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: "No file uploaded." });

//     // 🔹 Compute SHA-256 hash of uploaded file
//     const fileHash = computeFileHash(req.file.buffer);

//     // 🔹 Check blockchain for file hash
//     const isValid = blockchain.verifyIntegrity(fileHash);

//     res.json({ fileHash, isValid });
//   } catch (error) {
//     console.error("File verification error:", error);
//     res
//       .status(500)
//       .json({ error: "Error verifying file.", details: error.message });
//   }
// });

// 🔹 Function to Decrypt File
// function decryptBuffer(encryptedBuffer, iv) {
//   const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
//   const decipher = crypto.createDecipheriv(
//     "aes-256-cbc",
//     SECRET_KEY,
//     Buffer.from(iv, "hex")
//   );
//   const decrypted = Buffer.concat([
//     decipher.update(encryptedBuffer),
//     decipher.final(),
//   ]);
//   return decrypted;
// }

function decryptBuffer(encryptedBuffer, iv) {
  try {
    console.log(`🔹 Decryption IV: ${iv}`); // Log IV
    const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      SECRET_KEY,
      Buffer.from(iv, "hex")
    );
    decipher.setAutoPadding(true); // ✅ Ensure correct padding is handled
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);
    console.log(
      `✅ Decryption Success! First 20 Bytes: ${decrypted
        .slice(0, 20)
        .toString("hex")}`
    );
    console.log(`🔹 Decrypted File Buffer Length: ${decrypted.length}`);
    return decrypted;
  } catch (error) {
    console.error("❌ Decryption Error:", error);
    return null;
  }
}

function verifyFileHash(originalBuffer, blockchainHash) {
  const computedHash = computeFileHash(originalBuffer);
  console.log(`🔹 Hash Computed from Original Buffer: ${computedHash}`);
  console.log(`🔹 Expected Blockchain Hash: ${blockchainHash}`);
  return computedHash === blockchainHash;
}

router.post("/verify", async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: "File ID is required." });

    // 🔹 Find file metadata in MongoDB
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found." });

    console.log(`🔎 Found File in DB: ${file.originalName}`);
    console.log(`🔍 Expected Blockchain Hash: ${file.blockchainHash}`);

    // 🔹 Download the encrypted file from Google Cloud Storage
    const fileRef = bucket.file(file.storedName);
    const [encryptedFileBuffer] = await fileRef.download();
    console.log(
      `🔹 Encrypted File Buffer Length from GCS: ${encryptedFileBuffer.length}`
    );

    // 🔹 Decrypt the file
    const decryptedFileBuffer = decryptBuffer(
      encryptedFileBuffer,
      file.encryptionIV
    );

    // 🔹 Verify the file hash before checking blockchain
    const isHashValid = verifyFileHash(
      decryptedFileBuffer,
      file.blockchainHash
    );

    // 🔹 Verify file hash in blockchain
    const isValidOnBlockchain = await blockchain.verifyIntegrity(
      file.blockchainHash
    );
    console.log(`🔍 Blockchain verification result:`, isValidOnBlockchain);

    console.log(
      "🔹 First 20 Bytes of Encrypted Buffer:",
      encryptedFileBuffer.slice(0, 20).toString("hex")
    );
    console.log(
      "🔹 First 20 Bytes of Decrypted Buffer:",
      decryptedFileBuffer.slice(0, 20).toString("hex")
    );

    res.json({
      fileId: fileId,
      computedHash: computeFileHash(decryptedFileBuffer),
      expectedHash: file.blockchainHash,
      isValidFile: isHashValid,
      isValidBlockchain: isValidOnBlockchain,
    });
  } catch (error) {
    console.error("File verification error:", error);
    res
      .status(500)
      .json({ error: "Error verifying file.", details: error.message });
  }
});

// router.post("/verify", async (req, res) => {
//   try {
//     const { fileId } = req.body;
//     if (!fileId) return res.status(400).json({ error: "File ID is required." });

//     // 🔹 Find file metadata in MongoDB
//     const file = await File.findById(fileId);
//     if (!file) return res.status(404).json({ error: "File not found." });

//     console.log(`🔎 Found File in DB: ${file.originalName}`);
//     console.log(`🔍 Expected Blockchain Hash: ${file.blockchainHash}`);

//     // 🔹 Download the encrypted file from Google Cloud Storage
//     const fileRef = bucket.file(file.storedName);
//     const [encryptedFileBuffer] = await fileRef.download();

//     console.log(
//       `🔹 Encrypted File Buffer Length from GCS: ${encryptedFileBuffer.length}`
//     );

//     // 🔹 Decrypt the file
//     const decryptedFileBuffer = decryptBuffer(
//       encryptedFileBuffer,
//       file.encryptionIV
//     );

//     // 🔹 Compute SHA-256 hash of decrypted file
//     const fileHash = computeFileHash(decryptedFileBuffer);
//     console.log(`🔹 Hash Computed After Decryption: ${fileHash}`);

//     // 🔹 Verify file hash in blockchain
//     const isValidOnBlockchain = await blockchain.verifyIntegrity(fileHash);
//     // debug log
//     console.log(`🔍 Blockchain verification result:`, isValidOnBlockchain);

//     console.log(
//       "🔹 First 20 Bytes of Encrypted Buffer:",
//       encryptedFileBuffer.slice(0, 20).toString("hex")
//     );
//     console.log(
//       "🔹 First 20 Bytes of Decrypted Buffer:",
//       decryptedFileBuffer.slice(0, 20).toString("hex")
//     );

//     res.json({
//       fileId: fileId,
//       fileHash: fileHash,
//       isValid: isValidOnBlockchain,
//     });
//   } catch (error) {
//     console.error("File verification error:", error);
//     res
//       .status(500)
//       .json({ error: "Error verifying file.", details: error.message });
//   }
// });

// router.post("/verify", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: "No file uploaded." });

//     // 🔹 Compute SHA-256 hash of uploaded file
//     const fileHash = computeFileHash(req.file.buffer);

//     // 🔹 Find file metadata in MongoDB
//     const file = await File.findOne({ blockchainHash: fileHash });

//     // 🔹 Verify integrity in blockchain
//     const isValidOnBlockchain = blockchain.verifyIntegrity(fileHash);

//     res.json({
//       fileHash,
//       isValid: file && isValidOnBlockchain,
//     });
//   } catch (error) {
//     console.error("File verification error:", error);
//     res
//       .status(500)
//       .json({ error: "Error verifying file.", details: error.message });
//   }
// });

// 📌 3️⃣ **Share a File**
router.post("/share", async (req, res) => {
  try {
    const { fileId, ownerId, sharedUserId } = req.body;

    if (!fileId || !ownerId || !sharedUserId) {
      return res
        .status(400)
        .json({ error: "fileId, ownerId, and sharedUserId are required." });
    }

    // 🔹 Find the file
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found." });

    // 🔹 Ensure requester is the owner
    if (file.ownerId.toString() !== ownerId) {
      return res
        .status(403)
        .json({ error: "Only the owner can share the file." });
    }

    // 🔹 Share file with user
    await File.findByIdAndUpdate(fileId, {
      $addToSet: { sharedWith: sharedUserId },
    });
    await User.findByIdAndUpdate(sharedUserId, {
      $addToSet: { filesAccessed: fileId },
    });

    res.status(200).json({ message: "File shared successfully!", file });
  } catch (error) {
    console.error("File sharing error:", error);
    res
      .status(500)
      .json({ error: "Error sharing file.", details: error.message });
  }
});

// 📌 4️⃣ **Download a File (With Access Check)**
router.get("/download/:fileId/:userId", async (req, res) => {
  try {
    const { fileId, userId } = req.params;

    // 🔹 Find the file
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found." });

    // 🔹 Check if user is authorized
    if (
      file.ownerId.toString() !== userId &&
      !file.sharedWith.includes(userId)
    ) {
      return res.status(403).json({ error: "Access denied." });
    }

    // 🔹 Return download link
    res.status(200).json({ downloadUrl: file.storageUrl });
  } catch (error) {
    console.error("Download access error:", error);
    res
      .status(500)
      .json({ error: "Error retrieving file.", details: error.message });
  }
});

module.exports = router;
