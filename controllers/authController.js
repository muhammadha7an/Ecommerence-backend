const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { sendTemplate } = require("../services/emailService");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || "user",
});

const signup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Welcome email (never includes the password). A mail failure does not fail sign-up.
    const welcome = await sendTemplate("newUser", "customer", { name: user.name, email: user.email }, { to: user.email });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: publicUser(user),
      welcomeEmailSent: Boolean(welcome.sent),
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message: error.code === 11000 ? "Email already registered" : "Unable to create account",
    });
  }
};

const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured",
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



const updateProfile = async (req, res) => {
  try {     
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const address = req.body.address;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name) {
      user.name = name;
    }

    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }

      user.email = email;
    }

    if (address && typeof address === "object") {
      user.address = {
        street: String(address.street || "").trim(),
        city: String(address.city || "").trim(),
        postalCode: String(address.postalCode || "").trim(),
        phone: String(address.phone || "").trim(),
      };
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};  

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const logout = async (req, res) => {
  res.json({
    success: true,
    message: "Logout successful",
  });
};






const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if email exists in MongoDB
    const user = await User.findOne({ email });

    // Email does not exist
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email does not exist. Please enter a registered email address.",
      });
    }

    // Check email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(503).json({
        success: false,
        message: "Password reset email is not configured",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;

    user.resetPasswordExpires =
      Date.now() + 15 * 60 * 1000;

    await user.save();

    // Reset password URL
    const resetUrl =
      `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Send reset email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Reset Your Password",
      html: `
        <h2>Password Reset</h2>

        <p>Click the button below to reset your password:</p>

        <a
          href="${resetUrl}"
          style="
            display:inline-block;
            padding:10px 20px;
            background:#007bff;
            color:white;
            text-decoration:none;
            border-radius:5px;
          "
        >
          Reset Password
        </a>

        <p>This link will expire in 15 minutes.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email",
    });

  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};


 


const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const password = String(req.body.password || "");

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const issueToken = (user) => jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/*
 * Admin sign-in.
 * 1. Admins who set their own credentials in Admin → Settings sign in with their email (or display
 *    name) and the bcrypt-hashed password stored in MongoDB.
 * 2. Until the primary admin does that, the ADMIN_USERNAME / ADMIN_PASSWORD values from .env keep
 *    working exactly as before (first sign-in creates the admin account).
 */
const adminLogin = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const configuredUsername = process.env.ADMIN_USERNAME || "admin";
    const configuredPassword = process.env.ADMIN_PASSWORD || "admin";
    const configuredEmail = process.env.ADMIN_EMAIL || "admin@local.invalid";

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "JWT_SECRET is not configured" });
    }

    // 1) Database-managed admin credentials
    const managedAdmins = await User.find({
      role: "admin",
      adminCredentialsManaged: true,
      $or: [{ email: normalizeEmail(username) }, { name: username }],
    }).limit(5);

    for (const admin of managedAdmins) {
      if (await bcrypt.compare(password, admin.password)) {
        return res.json({ success: true, message: "Administrator login successful", token: issueToken(admin), user: publicUser(admin) });
      }
    }

    // 2) .env bootstrap credentials
    if (!safeEqual(username, configuredUsername) || !safeEqual(password, configuredPassword)) {
      return res.status(401).json({ success: false, message: "Invalid administrator credentials" });
    }

    let user =
      (await User.findOne({ isPrimaryAdmin: true })) ||
      (await User.findOne({ email: normalizeEmail(configuredEmail) }));

    if (user && user.adminCredentialsManaged) {
      return res.status(401).json({
        success: false,
        message: "These sign-in details were replaced in Admin Settings. Please use your updated email and password.",
      });
    }

    if (!user) {
      user = await User.create({
        name: configuredUsername,
        email: normalizeEmail(configuredEmail),
        password: await bcrypt.hash(configuredPassword, 10),
        role: "admin",
        isPrimaryAdmin: true,
      });
    } else if (user.role !== "admin" || !user.isPrimaryAdmin) {
      user.role = "admin";
      user.isPrimaryAdmin = true;
      await user.save();
    }

    return res.json({ success: true, message: "Administrator login successful", token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to sign in as administrator" });
  }
};

module.exports = {
  signup,
  login,
  adminLogin,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
};