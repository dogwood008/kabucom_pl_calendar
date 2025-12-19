import { defineConfig } from "vite";

export default defineConfig(async () => {
  const { viteStaticCopy } = await import("vite-plugin-static-copy");

  return {
    root: "public",
    base: "./",
    publicDir: false,
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "data/dummy_kabucom.csv",
            dest: "data",
          },
        ],
      }),
    ],
    server: {
      fs: {
        allow: [".."],
      },
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
  };
});
