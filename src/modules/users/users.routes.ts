import { Router } from "express";
import { usersController } from "./users.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { updateProfileSchema, updateNotificationsSchema, pushTokenSchema } from "./users.validation";

const router = Router();

router.use(authenticate);

router.get("/me", usersController.getMe);
router.patch("/me", validate(updateProfileSchema), usersController.updateMe);
router.patch("/me/notifications", validate(updateNotificationsSchema), usersController.updateNotifications);
router.post("/me/push-token", validate(pushTokenSchema), usersController.updatePushToken);
router.get("/me/stats", usersController.getStats);
router.get("/me/referral", usersController.getReferral);

export default router;
