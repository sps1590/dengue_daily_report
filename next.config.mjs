/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs and unpdf ship CJS/worker code that must not be bundled into the
  // serverless function by Turbopack/webpack.
  serverExternalPackages: ['exceljs', 'unpdf'],
};

export default nextConfig;
