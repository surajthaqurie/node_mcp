import { Router } from "express";
import { loginController, generateDevTokenController } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", loginController);
authRouter.post("/token", generateDevTokenController);
