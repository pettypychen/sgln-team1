import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        ...(env.VITE_ANTHROPIC_API_KEY
          ? {
              "/api/anthropic": {
                target: "https://api.anthropic.com",
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api\/anthropic/, ""),
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    proxyReq.setHeader("x-api-key", env.VITE_ANTHROPIC_API_KEY);
                    proxyReq.setHeader("anthropic-version", "2023-06-01");
                    proxyReq.removeHeader("origin");
                  });
                },
              },
            }
          : {}),
        ...(env.VITE_ZAI_API_KEY
          ? {
              "/api/zai": {
                target: "https://api.z.ai",
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api\/zai/, "/api/paas/v4"),
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    proxyReq.setHeader("Authorization", `Bearer ${env.VITE_ZAI_API_KEY}`);
                    proxyReq.removeHeader("origin");
                  });
                },
              },
            }
          : {}),
        ...(env.VITE_ALIBABA_API_KEY
          ? {
              "/api/qwen": {
                target: "https://dashscope-intl.aliyuncs.com",
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api\/qwen/, "/compatible-mode/v1"),
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    proxyReq.setHeader("Authorization", `Bearer ${env.VITE_ALIBABA_API_KEY}`);
                    proxyReq.removeHeader("origin");
                  });
                },
              },
            }
          : {}),
      },
    },
  };
});
