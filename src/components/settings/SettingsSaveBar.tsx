/**
 * SettingsSaveBar - Sticky save bar that appears when there are unsaved changes
 */

import { Save, Undo2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/data/stores/settingsStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface SettingsSaveBarProps {
  className?: string;
}

export function SettingsSaveBar({ className }: SettingsSaveBarProps) {
  const { isDirty, save, resetDraft, isLoading } = useSettingsStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  if (!isDirty) return null;
  
  const handleSave = async () => {
    try {
      await save(user?.id);
      toast({
        title: t('settings.settingsSaved'),
        description: user ? t('settings.loginToSync') : undefined,
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };
  
  const handleReset = () => {
    resetDraft();
  };
  
  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm",
        "lg:absolute lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:border-t-0 lg:border-b lg:bg-transparent lg:backdrop-blur-none",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-2 text-warning">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{t('settings.unsavedChanges')}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading}
          >
            <Undo2 className="w-4 h-4 mr-2" />
            {t('common.undo')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? t('common.loading') : t('settings.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SettingsSaveBar;
