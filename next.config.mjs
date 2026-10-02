/** @type {import('next').NextConfig} */
export default {
  ...(process.env.NODE_ENV !== "development" ? { output: "export" } : {}),
  poweredByHeader: false,
  images: { unoptimized: true },
  ...(process.env.NODE_ENV === "development" ? {
    async rewrites() {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:8787/api/:path*" }];
    },
  } : {}),
};
