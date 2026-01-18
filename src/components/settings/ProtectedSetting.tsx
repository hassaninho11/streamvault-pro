/**
 * ProtectedSetting - Wrapper that shows login prompt for guest users
 */

import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ProtectedSettingProps {
  children: ReactNode;
  className?: string;
}

export function ProtectedSetting({ children, className }: ProtectedSettingProps) {
  const { isGuest } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  if (!isGuest) {
    return <>{children}</>;
  }
  
  return (
    <div className={cn("relative", className)}>
      {/* Faded content overlay */}
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Login prompt overlay */}
      <div 
        className="absolute inset-0 flex items-center justify-end bg-background/50 backdrop-blur-[1px] rounded-lg cursor-pointer"
        onClick={() => navigate('/auth')}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 mr-4 rounded-md bg-muted/80 border border-border text-sm">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{t('settings.loginToEdit')}</span>
        </div>
      </div>
    </div>
  );
}

export default ProtectedSetting;
