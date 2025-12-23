/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Explicitly set the output file tracing root to the current project directory
  // This prevents Next.js from incorrectly inferring the workspace root when
  // multiple lockfiles exist (e.g., pnpm-lock.yaml in parent directories)
  outputFileTracingRoot: require('path').join(__dirname),
}

module.exports = nextConfig

