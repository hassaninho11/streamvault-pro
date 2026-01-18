/**
 * Terms of Service Page
 */
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_CONFIG } from "@/config/app";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-4" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-2xl">{APP_CONFIG.name} Användarvillkor</CardTitle>
            <p className="text-sm text-muted-foreground">Senast uppdaterad: Januari 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptans av villkor</h2>
                  <p>
                    Genom att använda {APP_CONFIG.name} accepterar du dessa användarvillkor. Om du inte 
                    accepterar villkoren, vänligen sluta använda appen.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">2. Tjänstens natur</h2>
                  <p>
                    <strong className="text-foreground">{APP_CONFIG.name} är en mediaspelare, inte en innehållsleverantör.</strong>
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Vi tillhandahåller, hostar eller distribuerar INGET medieinnehåll</li>
                    <li>Vi rekommenderar eller föreslår inga spellistor eller kanaler</li>
                    <li>All media som spelas i appen kommer från dina egna källor</li>
                    <li>Du är ensam ansvarig för de spellistor och strömmar du använder</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">3. Användaransvar</h2>
                  <p>Du ansvarar för att:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Säkerställa att du har rätt att använda de spellistor du lägger till</li>
                    <li>Följa alla tillämpliga lagar och bestämmelser i din jurisdiktion</li>
                    <li>Inte använda appen för att strömma olagligt innehåll</li>
                    <li>Hålla dina kontouppgifter säkra om du väljer att logga in</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">4. Provperiod och betalning</h2>
                  <p>
                    {APP_CONFIG.name} erbjuder en {APP_CONFIG.guestMode.trialDays} dagars kostnadsfri provperiod. 
                    Efter provperioden krävs en prenumeration för att fortsätta använda alla funktioner.
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Provperioden börjar vid första användningen</li>
                    <li>Prenumerationspris: {APP_CONFIG.subscription.pricePerYear} {APP_CONFIG.subscription.currency}/år</li>
                    <li>Prenumerationer hanteras via din betalningsleverantör</li>
                    <li>Avbokning kan göras när som helst</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">5. AI-genererade undertexter</h2>
                  <p>
                    Funktionen för AI-genererade undertexter:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Använder automatisk taligenkänning som kan innehålla fel</li>
                    <li>Genererar undertexter endast från dina egna videoströmmar</li>
                    <li>Ger inga garantier för noggrannhet</li>
                    <li>Får inte användas för att kringgå upphovsrättsskyddade undertexter</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">6. Ansvarsfriskrivning</h2>
                  <p>
                    {APP_CONFIG.name} tillhandahålls "i befintligt skick". Vi garanterar inte:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Att appen kommer att fungera felfritt</li>
                    <li>Att alla strömformat eller leverantörer stöds</li>
                    <li>Tillgängligheten av dina tredjepartskällor</li>
                    <li>Kompatibilitet med alla enheter</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">7. Begränsning av ansvar</h2>
                  <p>
                    Vi ansvarar inte för skador som uppstår från:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Innehållet i de spellistor du använder</li>
                    <li>Problem med dina tredjepartsleverantörer</li>
                    <li>Förlust av data</li>
                    <li>Obehörig åtkomst till ditt konto</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">8. Uppsägning</h2>
                  <p>
                    Vi förbehåller oss rätten att stänga av eller avsluta din åtkomst till tjänsten 
                    om du bryter mot dessa villkor.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">9. Ändringar i villkoren</h2>
                  <p>
                    Vi kan uppdatera dessa villkor när som helst. Fortsatt användning av appen 
                    efter ändringar innebär att du accepterar de uppdaterade villkoren.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">10. Kontakt</h2>
                  <p>
                    Vid frågor om dessa villkor, kontakta oss på: <br />
                    <span className="text-foreground">support@streamvault.app</span>
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
