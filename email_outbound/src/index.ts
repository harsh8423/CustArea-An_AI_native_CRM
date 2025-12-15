import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import tenantSesRoutes from "./routes/tenantSesRoutes";
import outboundRoutes from "./routes/outboundRoutes";
import { pool } from "./db";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Routes
console.log("Mounting /tenants routes...");
app.use("/tenants", (req, res, next) => {
    console.log(`Request to /tenants: ${req.method} ${req.path}`);
    next();
}, tenantSesRoutes);
app.use("/tenants", outboundRoutes);

// Helper route to create a tenant for testing
app.post("/tenants", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    try {
        const client = await pool.connect();
        const result = await client.query(
            "INSERT INTO tenants (name) VALUES ($1) RETURNING *",
            [name]
        );
        client.release();
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/", (req, res) => {
    res.send("Email Outbound Service Running");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
