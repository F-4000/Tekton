/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  // @noble/* packages use ESM exports maps that break under Next.js webpack bundling.
  // Mark them as external so Node.js resolves them natively at runtime.
  serverExternalPackages: ["@noble/curves", "@noble/hashes"],
  // Suppress warnings from optional transitive dependencies we don't use:
  // - @react-native-async-storage/async-storage  (MetaMask SDK — mobile only)
  // - pino-pretty                                 (WalletConnect logger — optional)
  // MetaMask mobile & WalletConnect deep-link support not yet wired up
  webpack: (config, { webpack: wp }) => {
    config.plugins.push(
      new wp.IgnorePlugin({
        resourceRegExp: /^@react-native-async-storage\/async-storage$/,
      }),
      new wp.IgnorePlugin({
        resourceRegExp: /^pino-pretty$/,
      })
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Dev needs 'unsafe-eval' for webpack HMR; WASM needs 'wasm-unsafe-eval'
              isDev
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
                : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://rpc.staging.midl.xyz https://blockscout.staging.midl.xyz https://mempool.staging.midl.xyz wss: https:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
