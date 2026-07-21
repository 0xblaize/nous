// Retired Next.js entry. The app now runs on Vite: `npm run dev` serves
// index.html -> src/main.tsx -> src/App.tsx (routes /landing, /login, /studio).
export default function Home() {
  return (
    <main style={{ padding: 40, background: "#EDEEF5", color: "#1a1a1a" }}>
      Nous moved to the Vite app. Run `npm run dev` and open http://localhost:3000/landing
    </main>
  );
}
