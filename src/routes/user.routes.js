import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
const router = Router()

router.route("/register").post(
    // clint upload the images
    upload.fields([
        {
            name: "avatar", // for frontend field the name has to be same as this name
            maxCount:1
        },
        {
            name: "coverImage", // for frontend field the name has to be same as this name
            maxCount:1
        }
    ]),
    registerUser
)

export default router;