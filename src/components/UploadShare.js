// import { useState, useEffect } from "react";
// import axios from "axios";
// import { Link } from "react-router-dom";
// import "bootstrap/dist/css/bootstrap.min.css";

// const UploadShare = () => {
//     const [file, setFile] = useState(null);
//     const [users, setUsers] = useState([]); // Available users
//     const [selectedUsers, setSelectedUsers] = useState([]); // Users to share file with
//     const [message, setMessage] = useState("");
//     const uploaderId = "your_user_id_here"; // Replace with actual logged-in user ID

//     // Write a function to Fetch users (Replace with actual API endpoint)
    

//     // Handle file selection
//     const handleFileChange = (event) => {
//         setFile(event.target.files[0]);
//     };

//     // Handle user selection
//     const handleUserSelect = (event) => {
//         const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
//         setSelectedUsers(selectedOptions);
//     };

//     // Handle form submission
//     const handleUpload = async (event) => {
//         event.preventDefault();

//         if (!file || selectedUsers.length === 0) {
//             setMessage("Please select a file and at least one user.");
//             return;
//         }

//         const formData = new FormData();
//         formData.append("file", file);
//         formData.append("uploaderId", uploaderId); // File owner

//         try {
//             // Upload file
//             const uploadResponse = await axios.post("http://localhost:5000/api/files/upload", formData, {
//                 headers: { "Content-Type": "multipart/form-data" }
//             });

//             // Share file with selected users
//             for (const userId of selectedUsers) {
//                 await axios.post("http://localhost:5000/api/files/share", {
//                     fileId: uploadResponse.data.fileId,
//                     ownerId: uploaderId,
//                     sharedUserId: userId
//                 });
//             }

//             setMessage("File uploaded and shared successfully!");
//         } catch (error) {
//             console.error("Upload error:", error);
//             setMessage("Error uploading file. Please try again.");
//         }
//     };

//     return (
//         <div className="container d-flex flex-column align-items-center justify-content-center vh-100">
//             <div className="container w-100">
//                 <Link to="/" className="btn btn-outline-primary btn-sm mt-3">
//                     ← Back to Dashboard
//                 </Link>
//             </div>
//             <div className="card shadow-lg p-4 border-0 w-50">
//                 <h2 className="text-center text-primary">Upload & Share File</h2>

//                 {message && <div className="alert alert-info text-center">{message}</div>}

//                 <form onSubmit={handleUpload}>
//                     <div className="mb-3">
//                         <label className="form-label">Select File</label>
//                         <input type="file" className="form-control" onChange={handleFileChange} required />
//                     </div>

//                     <div className="mb-3">
//                         <label className="form-label">Select Users to Share</label>
//                         <select className="form-select" multiple onChange={handleUserSelect} required>
//                             {users.map(user => (
//                                 <option key={user._id} value={user._id}>{user.username}</option>
//                             ))}
//                         </select>
//                         <small className="text-muted">Hold CTRL (or CMD on Mac) to select multiple users.</small>
//                     </div>

//                     <button type="submit" className="btn btn-primary w-100">Upload & Share</button>
//                 </form>

//             </div>
//         </div>
//     );
// };

// export default UploadShare;
import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const UploadShare = () => {
    const [file, setFile] = useState(null);
    const [users, setUsers] = useState([]); // Available users
    const [selectedUsers, setSelectedUsers] = useState([]); // Users to share file with
    const [message, setMessage] = useState("");
    const [uploaderId, setUploaderId] = useState(""); // Logged-in user ID

    // Fetch the logged-in user's ID (assuming it's stored in localStorage)
    useEffect(() => {
        const storedUserId = localStorage.getItem("userId");
        if (storedUserId) {
            setUploaderId(storedUserId);
        }else{
            console.error("No userId found in localStorage!");
        }
    }, []);

    // Fetch users from backend
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/get-users");
                setUsers(response.data.users);
            } catch (error) {
                console.error("Error fetching users:", error);
                setMessage("Failed to load users.");
            }
        };
        fetchUsers();
    }, []);

    // Handle file selection
    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
    };
    // Handle user selection
    const handleUserSelection = (userId) => {
      setSelectedUsers((prevSelected) =>
        prevSelected.includes(userId)
            ? prevSelected.filter((id) => id !== userId)
            : [...prevSelected, userId]
    );
    };
    // Handle form submission
    // const handleUpload = async (event) => {
    //     event.preventDefault();
    //     if (!uploaderId) {
    //         console.error("Uploader ID is missing!");
    //         return;
    //     }
    //     if (!file || selectedUsers.length === 0) {
    //         setMessage("Please select a file and at least one user.");
    //         return;
    //     }
    //     // const formattedSharedWith = selectedUsers.map(user => user._id); // Assuming each user has an `_id`
    //     const formData = new FormData();
    //     formData.append("file", file);
    //     formData.append("ownerId", uploaderId); // File owner
    //     // formData.append("sharedWith", JSON.stringify(formattedSharedWith)); // Ensure sharedWith is an array of ObjectId strings
    //     formData.append("sharedWith", JSON.stringify(selectedUsers));
    //     try {
    //         // Upload file
    //         const uploadResponse = await axios.post("http://localhost:5000/api/upload", formData, {
    //             headers: { "Content-Type": "multipart/form-data" }
    //         });

    //         // Share file with selected users
    //         await Promise.all(
    //             selectedUsers.map((sharedUserId) =>
    //                 axios.post("http://localhost:5000/api/share", {
    //                     fileId: uploadResponse.data.fileId,
    //                     ownerId: uploaderId,
    //                     sharedUserId
    //                 })
    //             )
    //         );
    //         setMessage("File uploaded and shared successfully!");
    //         setSelectedUsers([]);
    //         setFile(null);
    //     } catch (error) {
    //         console.error("Upload error:", error);
    //         setMessage("Error uploading file. Please try again.");
    //     }
    // };

    const handleUpload = async (event) => {
        event.preventDefault();
    
        console.log("Starting upload process...");
        console.log("Uploader ID state:", uploaderId);
        if (!uploaderId) {
            console.error("Uploader ID is missing!");
            return;
        }
    
        if (!file) {
            console.error("No file selected!");
            setMessage("Please select a file.");
            return;
        }
    
        if (selectedUsers.length === 0) {
            console.error("No users selected for sharing!");
            setMessage("Please select at least one user.");
            return;
        }
    
        const formattedSharedWith = selectedUsers; // Ensure correct ID format
        console.log("Uploader ID:", uploaderId);
        console.log("Selected File:", file);
        console.log("Selected Users:", selectedUsers);
        console.log("Formatted SharedWith:", formattedSharedWith);
    
        const formData = new FormData();
        formData.append("file", file);
        formData.append("ownerId", localStorage.getItem("userId"));
        formData.append("sharedWith", JSON.stringify(formattedSharedWith));
    
        console.log("FormData content:");
        for (let [key, value] of formData.entries()) {
            console.log(`${key}:`, value);
        }
    
        try {
            console.log("Sending request to upload file...");
    
            const uploadResponse = await axios.post("http://localhost:5000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
    
            console.log("Upload successful:", uploadResponse.data);
    
            // Share file with selected users
            await Promise.all(
                selectedUsers.map((userId) =>
                    axios.post("http://localhost:5000/api/share", {
                        fileId: uploadResponse.data.fileId,
                        ownerId: uploaderId,
                        sharedUserId: userId
                    })
                )
            );
    
            setMessage("File uploaded and shared successfully!");
            setSelectedUsers([]);
            setFile(null);
        } catch (error) {
            console.error("Upload error:", error.response?.data || error.message);
            setMessage("Error uploading file. Please try again.");
        }
    };
    
    return (
        <div className="container d-flex flex-column align-items-center justify-content-center vh-100">
            <div className="container w-100">
                <Link to="/" className="btn btn-outline-primary btn-sm mt-3">
                    ← Back to Dashboard
                </Link>
            </div>
            <div className="card shadow-lg p-4 border-0 w-50">
                <h2 className="text-center text-primary">Upload & Share File</h2>

                {message && <div className="alert alert-info text-center">{message}</div>}

                <form onSubmit={handleUpload}>
                <div className="mb-3">
                        <label className="form-label">Choose File</label>
                        <input type="file" className="form-control" onChange={handleFileChange} />
                    </div>
                <div className="mb-3">
                    <label className="form-label">Select Users to Share</label>
                    <div className="border rounded p-2" style={{ maxHeight: "200px", overflowY: "auto" }}>
                       {users.map(user => (
                           <div key={user._id} className="form-check d-flex align-items-center">
                           <input
                               type="checkbox"
                               className="form-check-input me-2"
                               id={user._id}
                               checked={selectedUsers.includes(user._id)}
                               onChange={() => handleUserSelection(user._id)}
                           />
                           <label className="form-check-label" htmlFor={user._id}>
                               {user.email}
                           </label>
                            </div>
                        ))}
                    </div>
                    
                </div>
                <button type="submit" className="btn btn-primary w-100">Upload & Share</button>
                </form>

            </div>
        </div>
    );
};

export default UploadShare;
