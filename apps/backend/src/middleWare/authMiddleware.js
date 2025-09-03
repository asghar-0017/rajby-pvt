import jwt from "jsonwebtoken";
import AdminSession from "../model/mysql/AdminSession.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // Verify JWT token first
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Check if it's a tenant token
    if (decoded.type === "tenant") {
      req.user = decoded;
      req.userType = "tenant";
      next();
      return;
    }

    // For admin tokens, verify session exists
    try {
      const session = await AdminSession.findOne({
        where: { token },
      });

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
      req.user = decoded;
      req.userType = "admin";
      next();
    } catch (error) {
      console.error("Error checking admin session:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication error",
      });
    }
  } catch (error) {
    console.error("Error in authentication middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
};
