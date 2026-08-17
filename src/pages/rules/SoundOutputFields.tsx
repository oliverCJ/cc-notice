import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  getSoundAssets,
  HardwareOutput,
  previewSound,
  SoundAsset
} from '../../api/tauriApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play } from 'lucide-react';
import { useI18n } from '@/i18n';
import { DeferredNumberInput } from './DeferredNumberInput';

type SoundOutputFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  onChange: (output: HardwareOutput) => void;
};

type SoundSourceMode = 'built-in' | 'user' | 'custom';

export function SoundOutputFields({
  internalEvent,
  output,
  onChange
}: SoundOutputFieldsProps) {
  const t = useI18n();
  const { toast } = useToast();
  const [assets, setAssets] = useState<SoundAsset[]>([]);
  const [sourceMode, setSourceMode] = useState<SoundSourceMode>('built-in');
  const [loadingAssets, setLoadingAssets] = useState(false);
  const filePath = output.soundFilePath ?? '';
  const displayFilePath = userFacingSoundPath(filePath);
  const volumePercent = output.soundVolumePercent ?? 80;
  const maxDurationMs = output.soundMaxDurationMs ?? 3000;
  const throttleSeconds = output.soundThrottleSeconds ?? 30;
  const builtInAssets = useMemo(
    () => assets.filter((asset) => asset.source === 'built-in'),
    [assets]
  );
  const userAssets = useMemo(
    () => assets.filter((asset) => asset.source === 'user'),
    [assets]
  );
  const currentAssetId = assets.find((asset) => asset.path === filePath)?.id ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoadingAssets(true);
    getSoundAssets()
      .then((nextAssets) => {
        if (!cancelled) {
          setAssets(nextAssets);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast({
            title: t('rules.sound.loadFailed'),
            description: String(error),
            variant: 'destructive'
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAssets(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (assets.some((asset) => asset.source === 'built-in' && asset.path === filePath)) {
      setSourceMode('built-in');
    } else if (assets.some((asset) => asset.source === 'user' && asset.path === filePath)) {
      setSourceMode('user');
    } else if (filePath) {
      setSourceMode('custom');
    }
  }, [assets, filePath]);

  async function chooseSoundFile() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'Audio',
          extensions: ['wav', 'aiff', 'aif', 'mp3', 'm4a']
        }
      ]
    });
    if (typeof selected !== 'string') {
      return;
    }
    onChange({
      ...output,
      soundFilePath: selected
    });
  }

  function selectAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }
    onChange({
      ...output,
      soundFilePath: asset.path
    });
  }

  async function previewSelectedSound() {
    if (!filePath.trim()) {
      toast({
        title: t('rules.sound.previewUnavailable'),
        description: t('rules.sound.chooseFirst'),
        variant: 'destructive'
      });
      return;
    }
    try {
      await previewSound(filePath, volumePercent, maxDurationMs);
      toast({
        title: t('rules.sound.previewStarted'),
        description: displayFilePath
      });
    } catch (error) {
      toast({
        title: t('rules.sound.previewFailed'),
        description: String(error),
        variant: 'destructive'
      });
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`sound-source-${internalEvent}`}>{t('rules.sound.source')}</Label>
        <Select value={sourceMode} onValueChange={(value) => setSourceMode(value as SoundSourceMode)}>
          <SelectTrigger id={`sound-source-${internalEvent}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="built-in">{t('rules.sound.sources.builtIn')}</SelectItem>
            <SelectItem value="user">{t('rules.sound.sources.user')}</SelectItem>
            <SelectItem value="custom">{t('rules.sound.sources.custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {sourceMode === 'built-in' && (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`sound-built-in-${internalEvent}`}>{t('rules.sound.builtIn')}</Label>
          <Select value={currentAssetId} onValueChange={selectAsset} disabled={builtInAssets.length === 0}>
            <SelectTrigger id={`sound-built-in-${internalEvent}`}>
              <SelectValue
                placeholder={loadingAssets ? t('common.loading') : t('rules.sound.chooseBuiltIn')}
              />
            </SelectTrigger>
            <SelectContent>
              {builtInAssets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {builtInAssets.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('rules.sound.emptyBuiltIn')}</p>
          )}
        </div>
      )}
      {sourceMode === 'user' && (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`sound-user-${internalEvent}`}>{t('rules.sound.user')}</Label>
          <Select value={currentAssetId} onValueChange={selectAsset} disabled={userAssets.length === 0}>
            <SelectTrigger id={`sound-user-${internalEvent}`}>
              <SelectValue
                placeholder={loadingAssets ? t('common.loading') : t('rules.sound.chooseUser')}
              />
            </SelectTrigger>
            <SelectContent>
              {userAssets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {userAssets.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t('rules.sound.emptyUser')}
            </p>
          )}
        </div>
      )}
      {sourceMode === 'custom' && (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`sound-file-${internalEvent}`}>
            {t('rules.sound.file')} <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id={`sound-file-${internalEvent}`}
              value={displayFilePath}
              placeholder="/path/to/notice.wav"
              onChange={(event) =>
                onChange({
                  ...output,
                  soundFilePath: event.target.value
                })
              }
            />
            <Button type="button" variant="outline" onClick={chooseSoundFile}>
              {t('common.select')}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label>{t('rules.sound.current')}</Label>
        <div className="flex items-center gap-2">
          <Input value={displayFilePath} readOnly placeholder={t('rules.sound.emptyFile')} />
          <Button type="button" variant="outline" onClick={previewSelectedSound} disabled={!filePath.trim()}>
            <Play className="mr-2 h-4 w-4" />
            {t('rules.sound.preview')}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`sound-volume-${internalEvent}`}>{t('rules.sound.volumePercent')}</Label>
        <DeferredNumberInput
          id={`sound-volume-${internalEvent}`}
          min={0}
          max={100}
          value={volumePercent}
          onCommit={(value) =>
            onChange({
              ...output,
              soundVolumePercent: value ?? 0
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`sound-duration-${internalEvent}`}>{t('rules.sound.maxDurationMs')}</Label>
        <DeferredNumberInput
          id={`sound-duration-${internalEvent}`}
          min={1}
          max={60000}
          value={maxDurationMs}
          onCommit={(value) =>
            onChange({
              ...output,
              soundMaxDurationMs: value ?? 1
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`sound-throttle-${internalEvent}`}>{t('rules.sound.throttleSeconds')}</Label>
        <DeferredNumberInput
          id={`sound-throttle-${internalEvent}`}
          min={0}
          max={3600}
          value={throttleSeconds}
          onCommit={(value) =>
            onChange({
              ...output,
              soundThrottleSeconds: value ?? 0
            })
          }
        />
      </div>
    </>
  );
}

function userFacingSoundPath(path: string) {
  if (path.startsWith('\\\\?\\')) {
    const rest = path.slice(4);
    if (rest.startsWith('UNC\\')) {
      return `\\\\${rest.slice(4)}`;
    }
    return rest;
  }
  if (path.startsWith('//?/')) {
    const rest = path.slice(4);
    if (rest.startsWith('UNC/')) {
      return `//${rest.slice(4)}`;
    }
    return rest;
  }
  return path;
}
