import { useState, useEffect } from "react";
import { useGetCart, getGetCartQueryKey, useCreateOrder, useListAddresses, getListAddressesQueryKey } from "@workspace/api-client-react";
import type { CartItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Package, AlertCircle, Loader2, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function formatCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

const PAYMENT_METHODS = [
  { value: "boleto",  label: "Boleto Bancário",  desc: "Vencimento em 3 dias úteis" },
  { value: "pix",     label: "PIX",               desc: "Pagamento imediato" },
  { value: "credito", label: "Cartão de Crédito", desc: "Em até 12x" },
];

export default function Checkout() {
  const { isApprovedBuyer } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cart, isLoading: cartLoading } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: isApprovedBuyer } });
  const { data: addresses, isLoading: addrLoading } = useListAddresses({ query: { queryKey: getListAddressesQueryKey(), enabled: isApprovedBuyer } });
  const createOrder = useCreateOrder();

  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("boleto");
  const [submitting, setSubmitting] = useState(false);
  const [newAddr, setNewAddr] = useState({
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  /* Pre-select the principal address */
  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddress) {
      const principal = addresses.find((a) => (a as { principal?: boolean }).principal);
      setSelectedAddress(String(principal?.id ?? addresses[0].id));
    }
  }, [addresses]);

  /* CEP auto-fill */
  async function handleCEP(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setNewAddr((a) => ({ ...a, cep: formatCEP(raw) }));
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const r = await fetch(`/api/cep/${digits}`);
        if (r.ok) {
          const data = await r.json();
          setNewAddr((a) => ({
            ...a,
            logradouro: data.logradouro || a.logradouro,
            bairro: data.bairro || a.bairro,
            cidade: data.localidade || a.cidade,
            estado: data.uf || a.estado,
          }));
        }
      } catch { /* silent */ } finally {
        setCepLoading(false);
      }
    }
  }

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

  if (cartLoading || addrLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-8">
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  const items: CartItem[] = cart?.items || [];
  const total = cart?.total || 0;
  const cartValido = cart?.valido !== false;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Seu carrinho está vazio</p>
          <Link href="/catalogo"><Button className="mt-4 bg-[#C0181A] hover:bg-[#a01418]">Ver catálogo</Button></Link>
        </div>
      </Layout>
    );
  }

  const usingNewAddress = selectedAddress === "new" || (!addresses?.length);

  async function handleConfirm() {
    if (!cartValido) {
      toast({ title: "Corrija as quantidades mínimas antes de finalizar", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let finalAddressId: number | undefined;

    try {
      if (usingNewAddress) {
        /* Validate required fields */
        if (!newAddr.cep || !newAddr.logradouro || !newAddr.numero || !newAddr.cidade || !newAddr.estado) {
          toast({ title: "Preencha todos os campos obrigatórios do endereço", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        /* Create address first */
        const r = await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            cep: newAddr.cep.replace(/\D/g, ""),
            logradouro: newAddr.logradouro,
            numero: newAddr.numero,
            complemento: newAddr.complemento,
            bairro: newAddr.bairro,
            cidade: newAddr.cidade,
            estado: newAddr.estado.toUpperCase(),
          }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          toast({ title: (err as { message?: string }).message || "Erro ao salvar endereço", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const saved = await r.json();
        finalAddressId = saved.id;
      } else {
        finalAddressId = Number(selectedAddress);
        if (!finalAddressId || isNaN(finalAddressId)) {
          toast({ title: "Selecione um endereço de entrega", variant: "destructive" });
          setSubmitting(false);
          return;
        }
      }

      if (!finalAddressId) {
        toast({ title: "Erro ao definir endereço de entrega", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const orders = await createOrder.mutateAsync({ data: { addressId: finalAddressId, observacoes: "" } });
      await queryClient.invalidateQueries();
      const createdOrders = Array.isArray(orders) ? orders : [orders];
      const ids = createdOrders.map((o: { id: number }) => o.id).filter(Boolean).join(",");
      navigate(`/pagamento?orders=${ids}&metodo=${paymentMethod}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Erro ao confirmar pedido";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Finalizar Pedido</h1>

        {!cartValido && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Seu carrinho tem itens com quantidade mínima não atendida.{" "}
              <Link href="/carrinho" className="font-semibold underline">Voltar ao carrinho</Link>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* ── Delivery address ── */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={16} className="text-[#C0181A]" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {addresses && addresses.length > 0 ? (
                  <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
                    {addresses.map((addr) => (
                      <div key={addr.id} className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${selectedAddress === String(addr.id) ? "border-[#C0181A] bg-[#C0181A]/5" : "border-border"}`}>
                        <RadioGroupItem value={String(addr.id)} id={`addr-${addr.id}`} className="mt-0.5" />
                        <label htmlFor={`addr-${addr.id}`} className="cursor-pointer text-sm flex-1">
                          <p className="font-medium">{addr.logradouro}, {addr.numero}{addr.complemento ? `, ${addr.complemento}` : ""}</p>
                          <p className="text-muted-foreground">{addr.bairro}, {addr.cidade} — {addr.estado}</p>
                          <p className="text-muted-foreground text-xs">CEP: {addr.cep}</p>
                        </label>
                      </div>
                    ))}
                    <div className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedAddress === "new" ? "border-[#C0181A] bg-[#C0181A]/5" : "border-dashed border-border"}`}>
                      <RadioGroupItem value="new" id="addr-new" />
                      <label htmlFor="addr-new" className="text-sm text-muted-foreground cursor-pointer">+ Usar outro endereço</label>
                    </div>
                  </RadioGroup>
                ) : null}

                {usingNewAddress && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">CEP <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          value={newAddr.cep}
                          onChange={(e) => handleCEP(e.target.value)}
                          placeholder="00000-000"
                          className="pr-8"
                        />
                        {cepLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Logradouro <span className="text-red-500">*</span></Label>
                      <Input value={newAddr.logradouro} onChange={(e) => setNewAddr((a) => ({ ...a, logradouro: e.target.value }))} placeholder="Rua, Av..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Número <span className="text-red-500">*</span></Label>
                      <Input value={newAddr.numero} onChange={(e) => setNewAddr((a) => ({ ...a, numero: e.target.value }))} placeholder="123" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Complemento</Label>
                      <Input value={newAddr.complemento} onChange={(e) => setNewAddr((a) => ({ ...a, complemento: e.target.value }))} placeholder="Sala, Galpão..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bairro</Label>
                      <Input value={newAddr.bairro} onChange={(e) => setNewAddr((a) => ({ ...a, bairro: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cidade <span className="text-red-500">*</span></Label>
                      <Input value={newAddr.cidade} onChange={(e) => setNewAddr((a) => ({ ...a, cidade: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estado <span className="text-red-500">*</span></Label>
                      <Input value={newAddr.estado} onChange={(e) => setNewAddr((a) => ({ ...a, estado: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Payment method ── */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                  {PAYMENT_METHODS.map((m) => (
                    <div key={m.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === m.value ? "border-[#C0181A] bg-[#C0181A]/5" : "border-border hover:bg-muted/30"}`}>
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

            {/* ── Items review ── */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Itens do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{item.product?.nome ?? `Produto #${item.productId}`}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.quantidade}× {item.product?.unidadeMedida || "un"} — {BRL(item.precoUnitario)} cada
                      </p>
                    </div>
                    <span className="font-semibold shrink-0 text-gray-900">{BRL(item.subtotal)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── Summary sidebar ── */}
          <div>
            <Card className="border-border shadow-none sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})</span>
                  <span>{BRL(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="text-emerald-600 font-medium">A calcular</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-[#C0181A]">{BRL(total)}</span>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  Nota fiscal será emitida pelo fornecedor. Preços sem IVA.
                </div>

                <Button
                  className="w-full bg-[#C0181A] hover:bg-[#a01418]"
                  size="lg"
                  onClick={handleConfirm}
                  disabled={submitting || !cartValido}
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin mr-2" />Confirmando...</>
                  ) : (
                    "Confirmar Pedido"
                  )}
                </Button>

                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                  <CheckCircle size={12} />
                  Pedido seguro e criptografado
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
