import multer from "multer";
import path from "path";

// Storage em memória — depois o handler chama uploadFile() (lib/storage.ts)
// para subir o buffer para o Supabase Storage.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Apenas imagens são permitidas"));
  },
});
