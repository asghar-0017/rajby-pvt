import adminService from "../../service/AdminAuthService/index.js";
import jwt from "jsonwebtoken";
import AdminMdel from "../../model/adminAuthModel/index.js";
import userModel from "../../model/registerUser/index.js";
import UserManagementService from "../../service/UserManagementService.js";

const secretKey = process.env.JWT_SECRET;

const combinedAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let user;
    let decoded;

    try {
      console.log("Attempting to validate admin token...");
      decoded = jwt.verify(token, secretKey);
      user = await AdminMdel.findOne({ email: decoded.email });
      if (user) {
        req.user = user;
        console.log(
          "Admin token validated successfully, proceeding to next middleware"
        );
        return next();
      }
    } catch (error) {
      console.log("Admin token validation failed:", error.message);
    }

    try {
      console.log("Attempting to validate User token...");
      decoded = jwt.verify(token, secretKey);

      // Check if it's a new user token (from UserManagementService)
      if (decoded.type === "user") {
        user = await UserManagementService.getUserByEmail(decoded.email);
        if (user) {
          req.user = user;
          req.userType = "user";
          console.log(
            "User token validated successfully, proceeding to next middleware"
          );
          return next();
        }
      } else {
        // Legacy user token validation
        user = await userModel.findOne({ email: decoded.email });
        if (user) {
          req.user = user;
          req.userType = "legacy_user";
          console.log(
            "Legacy user token validated successfully, proceeding to next middleware"
          );
          return next();
        }
      }
    } catch (error) {
      console.log("User token validation failed:", error.message);
    }
  } catch (error) {
    console.log("Internal Server Error:", error.message);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }

  res.status(403).json({ message: "Forbidden: Invalid token" });
};

export default combinedAuthenticate;
