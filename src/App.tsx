import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Rifa from "./pages/Rifa.tsx";
import Home from "./pages/Home.tsx";
import { RequireAdmin } from "./components/RequireAdmin";

// Lazy-load tudo que não é a landing principal, para o /rifa abrir rápido no mobile
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Pagamento = lazy(() => import("./pages/Pagamento.tsx"));
const Acompanhar = lazy(() => import("./pages/Acompanhar.tsx"));
const Ranking = lazy(() => import("./pages/Ranking.tsx"));
const Vendedor = lazy(() => import("./pages/Vendedor.tsx"));
const Seller = lazy(() => import("./pages/Seller.tsx"));
const Revendedor = lazy(() => import("./pages/Revendedor.tsx"));
const SellerOrderDetail = lazy(() => import("./pages/SellerOrderDetail.tsx"));
const Afiliacao = lazy(() => import("./pages/Afiliacao.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Eventos = lazy(() => import("./pages/admin/Eventos.tsx"));
const Reconciliacao = lazy(() => import("./pages/admin/Reconciliacao.tsx"));
const Alertas = lazy(() => import("./pages/admin/Alertas.tsx"));
const Entrada = lazy(() => import("./pages/Entrada.tsx"));
const Inscricao = lazy(() => import("./pages/Inscricao.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--hero-bg, 0 0% 6%))" }} />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/rifa" element={<Rifa />} />
            <Route path="/inscricao" element={<Inscricao />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pagamento/:orderId" element={<Pagamento />} />
            <Route path="/acompanhar" element={<Acompanhar />} />
            <Route path="/admin/ranking" element={<RequireAdmin><Ranking /></RequireAdmin>} />
            <Route path="/v/:refCode" element={<Vendedor />} />
            <Route path="/seller" element={<Seller />} />
            <Route path="/revendedor" element={<Revendedor />} />
            <Route path="/seller/pedido/:orderId" element={<SellerOrderDetail />} />
            <Route path="/afiliacao" element={<Afiliacao />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/admin/eventos" element={<RequireAdmin><Eventos /></RequireAdmin>} />
            <Route path="/admin/reconciliacao" element={<RequireAdmin><Reconciliacao /></RequireAdmin>} />
            <Route path="/admin/alertas" element={<RequireAdmin><Alertas /></RequireAdmin>} />
            <Route path="/camiseta" element={<Entrada />} />
            {/* /entrada legado: mantido como alias para não quebrar links antigos */}
            <Route path="/entrada" element={<Entrada />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
