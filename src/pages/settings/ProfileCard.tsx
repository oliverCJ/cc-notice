import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { useI18n } from '@/i18n';

type ProfileCardProps = {
  profile: {
    id: string;
    name: string;
    active: boolean;
  };
  onActivate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ProfileCard({ profile, onActivate, onDuplicate, onDelete }: ProfileCardProps) {
  const t = useI18n();

  return (
    <Card className={profile.active ? 'border-primary shadow-md' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{profile.name}</CardTitle>
              {profile.active && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {t('rules.profile.active')}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1.5 font-mono text-xs">
              {profile.id}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t('rules.profile.openMenu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onActivate} disabled={profile.active}>
                {t('rules.profile.activate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>{t('rules.profile.duplicate')}</DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                disabled={profile.active}
                className="text-destructive focus:text-destructive"
              >
                {t('rules.profile.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {!profile.active && (
        <CardContent className="pt-0">
          <Button variant="outline" size="sm" onClick={onActivate} className="w-full">
            {t('rules.profile.activateThis')}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
