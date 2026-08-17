import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, Star } from 'lucide-react';
import { ProfileTemplate, ProfileTemplateInfo, getProfileTemplateList } from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { profileTemplateDescription, profileTemplateName } from '@/lib/profileTemplateText';

type ProfileCreateDialogProps = {
  open: boolean;
  mode: 'create' | 'duplicate';
  sourceProfileName?: string;
  onClose: () => void;
  onCreate: (profileName: string, template?: ProfileTemplate) => void;
};

export function ProfileCreateDialog({
  open,
  mode,
  sourceProfileName,
  onClose,
  onCreate
}: ProfileCreateDialogProps) {
  const t = useI18n();
  const [profileName, setProfileName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProfileTemplate>('basic');
  const [templates, setTemplates] = useState<ProfileTemplateInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && mode === 'create') {
      getProfileTemplateList().then(setTemplates).catch(console.error);
    }
  }, [open, mode]);

  const title =
    mode === 'create'
      ? t('rules.profile.createDialogTitle')
      : t('rules.profile.duplicateDialogTitle');
  const description =
    mode === 'create'
      ? t('rules.profile.createDialogDescription')
      : t('rules.profile.duplicateDialogDescription', { name: sourceProfileName ?? '' });

  function handleSubmit() {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setError(t('rules.profile.nameRequired'));
      return;
    }
    if (trimmedName.length < 2) {
      setError(t('rules.profile.nameTooShort'));
      return;
    }
    if (trimmedName.length > 50) {
      setError(t('rules.profile.nameTooLong'));
      return;
    }
    setError('');
    onCreate(trimmedName, mode === 'create' ? selectedTemplate : undefined);
    setProfileName('');
    setSelectedTemplate('basic');
  }

  function handleClose() {
    setProfileName('');
    setSelectedTemplate('basic');
    setError('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{t('rules.profile.nameLabel')}</Label>
            <Input
              id="profile-name"
              placeholder={t('rules.profile.namePlaceholder')}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && mode === 'duplicate') {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('rules.profile.idHint')}
            </p>
          </div>

          {mode === 'create' && templates.length > 0 && (
            <div className="grid gap-2">
              <Label>{t('rules.profile.templateLabel')}</Label>
              <RadioGroup
                value={selectedTemplate}
                onValueChange={(value: string) => setSelectedTemplate(value as ProfileTemplate)}
              >
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent cursor-pointer"
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                      <Label htmlFor={template.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{profileTemplateName(template, t)}</span>
                          {template.recommended && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {profileTemplateDescription(template, t)}
                        </p>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit}>
            {mode === 'create' ? t('rules.profile.create') : t('rules.profile.duplicate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
