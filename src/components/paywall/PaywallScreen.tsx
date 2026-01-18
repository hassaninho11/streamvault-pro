/**
 * PaywallScreen - Full-screen gate when trial expires
 */
import { Zap, Check, RefreshCw, HelpCircle, FileText, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import { useEntitlements } from "@/hooks/useEntitlements";
import { cn } from "@/lib/utils";

export function PaywallScreen() {
  const navigate = useNavigate();
  const { purchase, restorePurchases, loading } = useEntitlements();

  const features = [
    "Obegränsad Live TV-tittning",
    "Obegränsat antal leverantörer",
    "AI-genererade undertexter",
    "Molnsynkronisering",
    "Avancerad EPG med catch-up",
    "Föräldrakontroll",
    "Health-dashboard",
    "Bild-i-bild och multiskärm",
  ];

  const handleUpgrade = async () => {
    await purchase("yearly");
  };

  const handleRestore = async () => {
    await restorePurchases();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg">
        <Card variant="glass" className="border-primary/30">
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow mb-4">
                <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
              </div>
              <h1 className={cn(
                "font-bold text-foreground mb-2",
                "text-xl sm:text-2xl leading-tight"
              )}>
                Din provperiod har utgått
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Uppgradera till Premium för att fortsätta använda {APP_CONFIG.name}
              </p>
            </div>

            {/* Price */}
            <div className="text-center mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <p className="text-3xl sm:text-4xl font-bold text-foreground">
                {APP_CONFIG.subscription.pricePerYear} {APP_CONFIG.subscription.currency}
              </p>
              <p className="text-muted-foreground text-sm">per år</p>
            </div>

            {/* Features */}
            <ul className="space-y-2 sm:space-y-3 mb-6">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                variant="premium"
                size="lg"
                className="w-full text-base"
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Uppgradera nu
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleRestore}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Återställ köp
              </Button>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs sm:text-sm text-muted-foreground">
              <button 
                onClick={() => navigate("/privacy")}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Shield className="w-3 h-3" />
                Integritetspolicy
              </button>
              <button 
                onClick={() => navigate("/terms")}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <FileText className="w-3 h-3" />
                Användarvillkor
              </button>
              <button 
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
                Kontakta support
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
