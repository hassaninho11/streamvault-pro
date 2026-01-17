/**
 * Health Dashboard Page - Stream monitoring and diagnostics
 */

import { AppLayout } from "@/components/layout/AppLayout";
import { HealthDashboard } from "@/components/health/HealthDashboard";

export default function Health() {
  return (
    <AppLayout>
      <div className="container max-w-6xl py-6">
        <HealthDashboard />
      </div>
    </AppLayout>
  );
}
