import { Router } from "express";
import { login, register } from "../controllers/authController.js";
import { validate } from "../middleware/validationMiddleware.js";
import { loginSchema, registerSchema } from "../schemas/authSchema.js";
import { uploadMiddleware } from "../middleware/upload.js";

const router = Router();

/*
 * Register accepts multipart/form-data so the client can
 * optionally include a selfie image alongside the JSON fields.
 * uploadMiddleware.single("selfie") parses the file into req.file.
 */
router.post(
  "/register",
  uploadMiddleware.single("selfie"),
  validate(registerSchema),
  register,
);

router.post("/login", validate(loginSchema), login);

export default router;