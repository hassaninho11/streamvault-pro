/**
 * Privacy Policy Page
 */
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_CONFIG } from "@/config/app";

export default function PrivacyPage() {
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
            <CardTitle className="text-2xl">{APP_CONFIG.name} Integritetspolicy</CardTitle>
            <p className="text-sm text-muted-foreground">Senast uppdaterad: Januari 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">1. Vad {APP_CONFIG.name} är</h2>
                  <p>
                    {APP_CONFIG.name} är en IPTV-spelare som låter dig titta på ditt eget innehåll från 
                    spellistor och leverantörer som du själv tillhandahåller. <strong className="text-foreground">Vi tillhandahåller, 
                    hostar eller rekommenderar inget innehåll.</strong> All media kommer från dina egna källor.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">2. Data som lagras lokalt</h2>
                  <p>Följande data lagras endast på din enhet (i din webbläsares IndexedDB):</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong className="text-foreground">Leverantörsuppgifter:</strong> M3U-URL:er och Xtream-inloggning lagras <em>krypterat</em></li>
                    <li><strong className="text-foreground">Favoriter:</strong> Lista över dina favoritkanaler</li>
                    <li><strong className="text-foreground">Senast tittat:</strong> Historik för snabb åtkomst</li>
                    <li><strong className="text-foreground">Inställningar:</strong> Tema, språk, spelarinställningar</li>
                    <li><strong className="text-foreground">Tittarhistorik (VOD):</strong> Position i filmer/serier</li>
                  </ul>
                  <p className="mt-2">
                    <strong className="text-foreground">Ingen av denna data skickas till oss</strong> om du inte aktivt 
                    väljer att logga in för molnsynk.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">3. Kryptering</h2>
                  <p>
                    Dina leverantörsuppgifter (URLs och lösenord) krypteras med AES-GCM innan de sparas. 
                    Krypteringsnyckeln genereras unikt per enhet och lagras säkert. Vi visar aldrig 
                    dina känsliga uppgifter i klartext i användargränssnittet efter import.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">4. Molnsynk (valfritt)</h2>
                  <p>
                    Om du väljer att logga in kan du synka dina inställningar och favoriter mellan 
                    enheter. I detta fall:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Din e-postadress lagras för autentisering</li>
                    <li>Krypterade leverantörsuppgifter synkas till molnet</li>
                    <li>Favoriter och inställningar synkas</li>
                  </ul>
                  <p className="mt-2">
                    Data lagras hos vår molnleverantör med branschstandard säkerhet. Du kan när som 
                    helst logga ut och behålla din data endast lokalt.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">5. AI-genererade undertexter</h2>
                  <p>
                    Om du använder AI-undertextfunktionen:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Ljudspår från din videoström analyseras för tal-till-text</li>
                    <li>Vi lagrar endast den genererade undertextfilen (VTT), inte något ljud</li>
                    <li>Undertexter sparas lokalt på din enhet</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">6. Analysdata</h2>
                  <p>
                    Vi samlar inte in personligt identifierbar information. Anonymiserad 
                    användningsstatistik kan samlas in för att förbättra appen, men detta 
                    inkluderar aldrig:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Vilka kanaler du tittar på</li>
                    <li>Dina leverantörsuppgifter</li>
                    <li>Innehåll från dina strömmar</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">7. Tredjepartstjänster</h2>
                  <p>
                    {APP_CONFIG.name} kan använda följande tredjepartstjänster:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Google OAuth för inloggning (om du väljer det)</li>
                    <li>Molntjänst för datasynkronisering (om du loggar in)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">8. Dina rättigheter</h2>
                  <p>Du har rätt att:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Radera all din lokala data (via Inställningar {">"} Cache)</li>
                    <li>Logga ut och ta bort molnsynkad data</li>
                    <li>Exportera din data som krypterad backup</li>
                    <li>Kontakta oss för att begära fullständig radering</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-2">9. Kontakt</h2>
                  <p>
                    Vid frågor om integritet, kontakta oss på: <br />
                    <span className="text-foreground">privacy@streamvault.app</span>
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
