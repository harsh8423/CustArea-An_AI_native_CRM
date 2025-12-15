import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import widgetInitRoute from "./routes/widgetInit";
import widgetChatRoute from "./routes/widgetChat";

const app = express();

app.use(express.json());
app.use(cors({
    origin: true, // you still verify origin manually per-site
    credentials: true,
}));

app.use(widgetInitRoute);
app.use(widgetChatRoute);

app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(CONFIG.port, () => {
    console.log(`API listening on ${CONFIG.port}`);
});
