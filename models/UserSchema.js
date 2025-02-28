const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,  // Hashed password
    role: { type: String, default: "user" },  // Could be investigator, forensic analyst, etc.
    filesAccessed: [{ type: mongoose.Schema.Types.ObjectId, ref: "File" }],  // Files user accessed
}, { timestamps: true });

const UserModel = mongoose.model("UserAuth", UserSchema);

module.exports=UserModel;