import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import quotesRouter from "./quotes";
import reviewsRouter from "./reviews";
import wishlistRouter from "./wishlist";
import addressesRouter from "./addresses";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import bannersRouter from "./banners";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(quotesRouter);
router.use(reviewsRouter);
router.use(wishlistRouter);
router.use(addressesRouter);
router.use(adminRouter);
router.use(dashboardRouter);
router.use(bannersRouter);

export default router;
