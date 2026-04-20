import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AwaitingApproval from "@/pages/awaiting-approval";
import Catalog from "@/pages/catalog";
import Product from "@/pages/product";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Wishlist from "@/pages/wishlist";
import Quotes from "@/pages/quotes";
import QuoteDetail from "@/pages/quote-detail";
import SupplierDashboard from "@/pages/supplier/dashboard";
import SupplierProductForm from "@/pages/supplier/product-form";
import AdminDashboard from "@/pages/admin/dashboard";
import SupportPanel from "@/pages/support/painel";
import QuemSomos from "@/pages/quem-somos";
import ComoFunciona from "@/pages/como-funciona";
import SejaFornecedor from "@/pages/seja-fornecedor";
import MinhaConta from "@/pages/minha-conta";
import FornecedorPerfil from "@/pages/fornecedor-perfil";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Register} />
      <Route path="/cadastro/aguardando" component={AwaitingApproval} />
      <Route path="/catalogo" component={Catalog} />
      <Route path="/categorias" component={Catalog} />
      <Route path="/produto/:id" component={Product} />
      <Route path="/carrinho" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/pedidos" component={Orders} />
      <Route path="/pedido/:id" component={OrderDetail} />
      <Route path="/favoritos" component={Wishlist} />
      <Route path="/cotacoes" component={Quotes} />
      <Route path="/cotacao/:id" component={QuoteDetail} />
      <Route path="/minha-conta" component={MinhaConta} />
      <Route path="/fornecedor/painel" component={SupplierDashboard} />
      <Route path="/fornecedor/produto/:id" component={SupplierProductForm} />
      <Route path="/fornecedor/:id" component={FornecedorPerfil} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/suporte" component={SupportPanel} />
      <Route path="/quem-somos" component={QuemSomos} />
      <Route path="/como-funciona" component={ComoFunciona} />
      <Route path="/seja-fornecedor" component={SejaFornecedor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
