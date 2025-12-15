import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            name: "MyChatbotWidget",
            fileName: "widget",
            formats: ["iife"],
        },
        rollupOptions: {
            output: {
                extend: true,
            },
        },
        minify: "esbuild",
        target: "es2018",
    },
});
