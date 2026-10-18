import react from "@vitejs/plugin-react-swc"
import externalGlobals from "rollup-plugin-external-globals"
import { defineConfig } from "vite"

export default defineConfig(({ command }) => {
  return {
    define: {
      // 把 process.env 整体替换为空对象，避免依赖在 Orca webview 中读取 process
      "process.env": "{}",
      "process.env.NODE_ENV": JSON.stringify(
        command === "build" ? "production" : "development",
      ),
    },
    build: {
      minify: false,
      lib: {
        entry: "src/main.tsx",
        fileName: "index",
        formats: ["es"],
      },
      rollupOptions: {
        external: ["react", "react-dom", "valtio"],
      },
    },
    plugins: [
      react({
        // 强制 classic JSX runtime：automatic runtime 会 import `react/jsx-runtime`，
        // 该模块引用 process.env 与 require("react")，在 Orca webview 里会出问题，
        // 且会把 development 版运行时打进产物（双运行时）。
        // classic 输出 React.createElement，Orca 提供全局 React。
        plugins: [],
        useAtYourOwnRisk_mutateSwcOptions: (options) => {
          if (options.jsc?.transform?.react) {
            options.jsc.transform.react.runtime = "classic"
          }
        },
      }),
      externalGlobals({
        react: "React",
        "react-dom": "ReactDOM",
        valtio: "Valtio",
      }),
    ],
  }
})
