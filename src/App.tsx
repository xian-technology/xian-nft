import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Toasts } from "./components/Toasts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { IndexerStatusBanner } from "./components/IndexerStatusBanner";
import { ToastProvider } from "./hooks/useToasts";
import { WalletProvider } from "./hooks/useWallet";

const Home = lazy(() => import("./routes/Home"));
const Collections = lazy(() => import("./routes/Collections"));
const CollectionDetail = lazy(() => import("./routes/CollectionDetail"));
const TokenDetail = lazy(() => import("./routes/TokenDetail"));
const Create = lazy(() => import("./routes/Create"));
const Profile = lazy(() => import("./routes/Profile"));
const Activity = lazy(() => import("./routes/Activity"));

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
            <IndexerStatusBanner />
            <Header />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/collections/:contract" element={<CollectionDetail />} />
                    <Route
                      path="/collections/:contract/token/:tokenId"
                      element={<TokenDetail />}
                    />
                    <Route path="/create" element={<Create />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/:address" element={<Profile />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
            <Toasts />
          </div>
        </BrowserRouter>
      </WalletProvider>
    </ToastProvider>
  );
}

function PageFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="space-y-4">
        <div className="shimmer rounded-2xl h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer rounded-2xl aspect-square" />
          ))}
        </div>
      </div>
    </div>
  );
}
