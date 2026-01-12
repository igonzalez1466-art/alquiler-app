// postcss.config.mjs
import tailwindcss from "tailwindcss";
import tailwindcssNesting from "@tailwindcss/nesting";
import autoprefixer from "autoprefixer";

export default {
  plugins: [
    tailwindcssNesting,
    tailwindcss,
    autoprefixer,
  ],
};
