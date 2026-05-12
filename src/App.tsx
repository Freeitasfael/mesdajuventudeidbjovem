import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Rifa from "./pages/Rifa.tsx";
import Checkout from "./pages/Checkout.tsx";
import Pagamento from "./pages/Pagamento.tsx";
import Acompanhar from "./pages/Acompanhar.tsx";
import Ranking from "./pages/Ranking.tsx";
import Vendedor from "./pages/Vendedor.tsx";
import Seller from "./pages/Seller.tsx";
import SellerOrderDetail from "./pages/SellerOrderDetail.tsx";
import Afiliacao from "./pages/Afiliacao.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Eventos from "./pages/admin/Eventos.tsx";
import Reconciliacao from "./pages/admin/Reconciliacao.tsx";
import Alertas from "./pages/admin/Alertas.tsx";
import { RequireAdmin } from "./components/RequireAdmin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Rifa />} />
          <Route path="/rifa" element={<Rifa />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pagamento/:orderId" element={<Pagamento />} />
          <Route path="/acompanhar" element={<Acompanhar />} />
          <Route path="/admin/ranking" element={<RequireAdmin><Ranking /></RequireAdmin>} />
          <Route path="/v/:refCode" element={<Vendedor />} />
          <Route path="/seller" element={<Seller />} />
          <Route path="/seller/pedido/:orderId" element={<SellerOrderDetail />} />
          <Route path="/afiliacao" element={<Afiliacao />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/admin/eventos" element={<RequireAdmin><Eventos /></RequireAdmin>} />
          <Route path="/admin/reconciliacao" element={<RequireAdmin><Reconciliacao /></RequireAdmin>} />
          <Route path="/admin/alertas" element={<RequireAdmin><Alertas /></RequireAdmin>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
