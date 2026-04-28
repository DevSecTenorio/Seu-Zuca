import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import reviewsRouter from "./reviews";
import wishlistRouter from "./wishlist";
import addressesRouter from "./addresses";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import bannersRouter from "./banners";
import supportRouter from "./support";
import storageRouter from "./storage";
import reportsRouter from "./reports";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(reviewsRouter);
router.use(wishlistRouter);
router.use(addressesRouter);
router.use(adminRouter);
router.use(dashboardRouter);
router.use(bannersRouter);
router.use(supportRouter);
router.use(storageRouter);
router.use(reportsRouter);
router.use(paymentsRouter);

export default router;
