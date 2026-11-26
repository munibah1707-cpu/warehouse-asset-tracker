const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `asset-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed."));
    }
    cb(null, true);
  },
});

// POST /api/assets
app.post("/api/assets", (req, res) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const assetId = (req.body.asset_id || "").trim();
    const category = (req.body.category || "").trim();
    const source = (req.body.source || "manual").trim();

    if (!assetId || !category) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "asset_id and category are required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Asset photograph is required." });
    }

    if (source !== "manual" && source !== "automated") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "source must be 'manual' or 'automated'." });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO assets (asset_id, category, photo_path, source)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(assetId, category, req.file.filename, source);
      const created = db.prepare("SELECT * FROM assets WHERE id = ?").get(result.lastInsertRowid);
      return res.status(201).json(created);
    } catch (dbErr) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (dbErr.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: `Asset ID '${assetId}' already exists.` });
      }
      return res.status(500).json({ error: "Failed to save asset record." });
    }
  });
});

// GET /api/assets?search=...
app.get("/api/assets", (req, res) => {
  const search = (req.query.search || "").trim();
  if (search) {
    const rows = db
      .prepare("SELECT * FROM assets WHERE asset_id LIKE ? ORDER BY id DESC")
      .all(`%${search}%`);
    return res.json(rows);
  }
  const rows = db.prepare("SELECT * FROM assets ORDER BY id DESC").all();
  return res.json(rows);
});

// GET /api/assets/:assetId
app.get("/api/assets/:assetId", (req, res) => {
  const row = db
    .prepare("SELECT * FROM assets WHERE asset_id = ?")
    .get(req.params.assetId);

  if (!row) {
    return res.status(404).json({ error: "Asset not found." });
  }
  return res.json(row);
});
// DELETE /api/assets/:id
app.delete("/api/assets/:id", (req, res) => {
  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(req.params.id);

  if (!asset) {
    return res.status(404).json({ error: "Asset not found." });
  }

  try {
    db.prepare("DELETE FROM assets WHERE id = ?").run(req.params.id);

    // Delete the associated image file from uploads/
    if (asset.photo_path) {
      const filePath = path.join(UPLOAD_DIR, asset.photo_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.json({ message: "Asset deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete asset." });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
