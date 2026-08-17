import { AlertCircle, Copy, Download, Plus, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCard } from '../settings/ProfileCard';
import { useI18n } from '@/i18n';

type ProfileSummary = {
  id: string;
  name: string;
  active: boolean;
};

type ProfileManagementSectionProps = {
  activeProfile?: ProfileSummary;
  profileError?: string;
  profiles: ProfileSummary[];
  onActivateProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  onDeleteProfile: (profileId: string, profileName: string) => void;
  onDuplicateActiveProfile: () => void;
  onDuplicateProfile: (profileId: string, profileName: string) => void;
  onExportProfilePackage: () => void;
  onImportProfilePackage: () => void;
};

export function ProfileManagementSection({
  activeProfile,
  profileError,
  profiles,
  onActivateProfile,
  onCreateProfile,
  onDeleteProfile,
  onDuplicateActiveProfile,
  onDuplicateProfile,
  onExportProfilePackage,
  onImportProfilePackage
}: ProfileManagementSectionProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('rules.profile.title')}</CardTitle>
            <CardDescription className="mt-1.5">
              {t('rules.profile.description')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onImportProfilePackage}>
              <Upload className="mr-2 h-4 w-4" />
              {t('rules.profile.import')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeProfile}
              onClick={onExportProfilePackage}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('rules.profile.export')}
            </Button>
            <Button variant="outline" size="sm" onClick={onCreateProfile}>
              <Plus className="mr-2 h-4 w-4" />
              {t('rules.profile.create')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeProfile}
              onClick={onDuplicateActiveProfile}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('rules.profile.duplicateCurrent')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profileError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{profileError}</AlertDescription>
          </Alert>
        )}
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('rules.profile.empty')}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onCreateProfile}>
              <Plus className="mr-2 h-4 w-4" />
              {t('rules.profile.createFirst')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onActivate={() => onActivateProfile(profile.id)}
                onDuplicate={() => onDuplicateProfile(profile.id, profile.name)}
                onDelete={() => onDeleteProfile(profile.id, profile.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
