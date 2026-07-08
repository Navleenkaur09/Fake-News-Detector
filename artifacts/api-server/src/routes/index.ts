import { Router, type IRouter } from "express";
import healthRouter from "./health";
import predictRouter from "./predict";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(predictRouter);
router.use(dashboardRouter);

export default router;
