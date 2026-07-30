import fs from "node:fs";
import path from "node:path";

import multer from "multer";

const uploadDirectory = path.resolve("uploads");

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/\s+/g, "-");

    cb(null, `${timestamp}-${sanitizedName}`);
  },
});

export const uploadMiddleware = multer({
  storage,

  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
    files: 1000,
  },
});