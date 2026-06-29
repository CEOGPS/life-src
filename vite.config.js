import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load ALL env vars (no prefix filter) so we can manually pick safe ones.
    // We cannot use envPrefix:'VITE_' because .env has illegal identifier names
    // (VITE_X.COM_API_KEY, VITE_MAKE.COM_API_KEY, VITE_D-ID_API_KEY) that
    // cause esbuild to crash. We manually define only the ones we actually use.
    const env = loadEnv(mode, process.cwd(), '');

    const define = {
        // Runtime flags
        'import.meta.env.MODE': JSON.stringify(mode),
        'import.meta.env.DEV': mode !== 'production' ? 'true' : 'false',
        'import.meta.env.PROD': mode === 'production' ? 'true' : 'false',

        // Firebase
        'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY ?? ''),
        'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
        'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID ?? ''),
        'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET ?? ''),
        'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
        'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID ?? ''),
        'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID ?? ''),

        // Worker / API
        'import.meta.env.VITE_WORKER_URL': JSON.stringify(env.VITE_WORKER_URL ?? ''),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),

        // AI Keys
        'import.meta.env.VITE_ANTHROPIC_API_KEY': JSON.stringify(env.VITE_ANTHROPIC_API_KEY ?? ''),
        'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY ?? ''),
        'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(env.VITE_GROQ_API_KEY ?? ''),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? ''),
        'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(env.VITE_DEEPSEEK_API_KEY ?? ''),
        'import.meta.env.VITE_GROK_API_KEY': JSON.stringify(env.VITE_GROk_API_KEY ?? ''),
    };

    return {
        plugins: [react()],
        envPrefix: 'VITE_BUILD_DUMMY_', // keep to prevent auto-injection of illegal-named vars
        define,
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@components': path.resolve(__dirname, './src/components'),
                '@lib': path.resolve(__dirname, './src/lib'),
                '@contexts': path.resolve(__dirname, './src/contexts'),
            },
        },
        optimizeDeps: {
            include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
            exclude: ['react-quill'],
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            target: 'es2022',
        },
    };
});