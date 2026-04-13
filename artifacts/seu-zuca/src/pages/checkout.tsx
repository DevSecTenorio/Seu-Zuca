import { useState } from "react";
import { useGetCart, useCreateOrder, useListAddresses } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Package, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Checkout() {
  const { isApprovedBuyer } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cart, isLoading: cartLoading } = useGetCart({ query: { enabled: isApprovedBuyer } });
  const { data: addresses } = useListAddresses({ query: { enabled: isApprovedBuyer } });
  const createOrder = useCreateOrder();

  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("boleto");
  const [newAddress, setNewAddress] = useState({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });

  if (!isApprovedBuyer) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">Acesso restrito a compradores aprovados</p>
          <Link href="/login"><Button>Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  if (cartLoading) {
    return <Layout><div className="max-w-4xl mx-auto p-8"><div className="h-64 bg-muted animate-pulse rounded" /></div></Layout>;
  }

  const items = cart?.items || [];
  const total = cart?.total || 0;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Seu carrinho está vazio</p>
          <Link href="/catalogo"><Button className="mt-4">Ver catálogo</Button></Link>
        </div>
      </Layout>
    );
  }

  async function handleConfirm() {
    const addressId = selectedAddress ? Number(selectedAddress) : undefined;
    if (!addressId && !newAddress.logradouro) {
      toast({ title: "Informe um endereço de entrega", variant: "destructive" });
      return;
    }

    try {
      const payload: { addressId?: number; paymentMethod: string; enderecoEntrega?: typeof newAddress } = {
        paymentMethod,
      };
      if (addressId) {
        payload.addressId = addressId;
      } else {
        payload.enderecoEntrega = newAddress;
      }

      await createOrder.mutateAsync({ data: payload });
      await queryClient.invalidateQueries();
      toast({ title: "Pedido realizado com sucesso!" });
      navigate("/pedidos");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao criar pedido";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Finalizar Pedido</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery address */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Endereço de Entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {addresses && addresses.length > 0 ? (
                  <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
                    {addresses.map((addr) => (
                      <div key={addr.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                        <RadioGroupItem value={String(addr.id)} id={`addr-${addr.id}`} className="mt-0.5" />
                        <label htmlFor={`addr-${addr.id}`} className="cursor-pointer text-sm">
                          <p className="font-medium">{addr.logradouro}, {addr.numero}</p>
                          {addr.complemento && <p className="text-muted-foreground">{addr.complemento}</p>}
                          <p className="text-muted-foreground">{addr.bairro}, {addr.cidade} - {addr.estado}</p>
                          <p className="text-muted-foreground">CEP: {addr.cep}</p>
                        </label>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 p-3 border border-dashed border-border rounded-lg">
                      <RadioGroupItem value="new" id="addr-new" className="mt-0.5" />
                      <label htmlFor="addr-new" className="text-sm text-muted-foreground cursor-pointer">Usar outro endereço</label>
                    </div>
                  </RadioGroup>
                ) : null}

                {(selectedAddress === "new" || !addresses?.length) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">CEP</Label>
                      <Input value={newAddress.cep} onChange={(e) => setNewAddress((a) => ({ ...a, cep: e.target.value }))} placeholder="00000-000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Logradouro</Label>
                      <Input value={newAddress.logradouro} onChange={(e) => setNewAddress((a) => ({ ...a, logradouro: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Número</Label>
                      <Input value={newAddress.numero} onChange={(e) => setNewAddress((a) => ({ ...a, numero: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Complemento</Label>
                      <Input value={newAddress.complemento} onChange={(e) => setNewAddress((a) => ({ ...a, complemento: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bairro</Label>
                      <Input value={newAddress.bairro} onChange={(e) => setNewAddress((a) => ({ ...a, bairro: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={newAddress.cidade} onChange={(e) => setNewAddress((a) => ({ ...a, cidade: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estado</Label>
                      <Input value={newAddress.estado} onChange={(e) => setNewAddress((a) => ({ ...a, estado: e.target.value }))} placeholder="SP" maxLength={2} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                  {[
                    { value: "boleto", label: "Boleto Bancário", desc: "Vencimento em 3 dias úteis" },
                    { value: "pix", label: "PIX", desc: "Pagamento imediato" },
                    { value: "credito", label: "Cartão de Crédito", desc: "Em até 12x" },
                  ].map((m) => (
                    <div key={m.value} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer">
                      <RadioGroupItem value={m.value} id={`pay-${m.value}`} className="mt-0.5" />
                      <label htmlFor={`pay-${m.value}`} className="cursor-pointer">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Items review */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Itens do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-medium line-clamp-1">{item.productNome}</p>
                      <p className="text-muted-foreground text-xs">{item.quantidade}x {item.unidadeMedida}</p>
                    </div>
                    <span className="font-medium shrink-0">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((item.preco || 0) * item.quantidade)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div>
            <Card className="border-border sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Total do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</span>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  Preços sem IVA. Nota fiscal será emitida pelo fornecedor.
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleConfirm}
                  disabled={createOrder.isPending}
                >
                  {createOrder.isPending ? "Confirmando..." : "Confirmar Pedido"}
                </Button>
                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                  <CheckCircle size={12} />
                  Pagamento seguro via Stripe
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
