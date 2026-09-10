import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import type { PersonalCustomFaceAsset } from '@/api/tauriApi';
import { CustomFaceAnimatedPreview } from './CustomFaceAnimatedPreview';

type Props = {
  groupId: string;
  activeTab: 'group' | 'public';
  onTabChange: (tab: 'group' | 'public') => void;
  personalAssets?: PersonalCustomFaceAsset[];
  onApplyPersonal?: (asset: PersonalCustomFaceAsset) => void;
  onSaveCurrent?: (scope: 'group' | 'public') => void;
  onDeletePersonal?: (assetId: string) => void;
  onRenamePersonal?: (asset: PersonalCustomFaceAsset, name: string) => void;
  onUpdateTags?: (asset: PersonalCustomFaceAsset, tags: string[]) => void;
  highlightAssetId?: string | null;
  open?: boolean;
  onClose?: () => void;
};

export function CustomFaceAssetLibrary({
  groupId,
  activeTab,
  onTabChange,
  personalAssets = [],
  onApplyPersonal,
  onSaveCurrent,
  onDeletePersonal,
  onRenamePersonal,
  onUpdateTags,
  highlightAssetId,
  open = true,
  onClose,
}: Props) {
  const t = useI18n();
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (highlightAssetId)
      cardRefs.current[highlightAssetId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightAssetId]);
  if (!open) return null;
  const inScope = personalAssets.filter((asset) =>
    activeTab === 'public'
      ? asset.scope === 'public'
      : asset.scope === 'group' && asset.groupId === groupId
  );
  const visibleAssets = inScope.filter(
    (asset) =>
      !tagFilter.trim() ||
      asset.tags.some((tag) =>
        tag.toLocaleLowerCase().includes(tagFilter.trim().toLocaleLowerCase())
      )
  );
  const availableTags = [...new Set(inScope.flatMap((asset) => asset.tags))].sort();
  return (
    <section
      aria-label={t('customFaceEditor.assets.label')}
      className="fixed right-0 top-0 z-40 h-full w-[min(480px,90vw)] overflow-y-auto border-l border-border bg-background p-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{t('customFaceEditor.assets.label')}</h2>
        <button
          type="button"
          aria-label={t('customFaceEditor.assets.close')}
          className="border border-border px-2 py-1 text-xs"
          onClick={onClose}
        >
          {t('customFaceEditor.assets.close')}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3">
        <button
          type="button"
          className={
            activeTab === 'group'
              ? 'border border-primary bg-primary/10 px-2 py-1 text-xs'
              : 'border border-border px-2 py-1 text-xs'
          }
          onClick={() => onTabChange('group')}
        >
          {t('customFaceEditor.assets.groupTab')}
        </button>
        <button
          type="button"
          className={
            activeTab === 'public'
              ? 'border border-primary bg-primary/10 px-2 py-1 text-xs'
              : 'border border-border px-2 py-1 text-xs'
          }
          onClick={() => onTabChange('public')}
        >
          {t('customFaceEditor.assets.publicTab')}
        </button>
      </div>
      <input
        aria-label={t('customFaceEditor.assets.filter')}
        placeholder={t('customFaceEditor.assets.filter')}
        className="mt-2 w-full border border-border px-2 py-1 text-xs"
        value={tagFilter}
        onChange={(event) => setTagFilter(event.target.value)}
      />
      {availableTags.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={
                tagFilter === tag
                  ? 'border border-primary bg-primary/10 px-1 text-[10px]'
                  : 'border border-border px-1 text-[10px]'
              }
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
          <button
            type="button"
            className="px-1 text-[10px] text-muted-foreground"
            onClick={() => setTagFilter('')}
          >
            {t('customFaceEditor.assets.clearFilter')}
          </button>
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {visibleAssets.map((asset) => (
          <div
            key={asset.assetId}
            ref={(element) => {
              cardRefs.current[asset.assetId] = element;
            }}
            onMouseEnter={() => setHoveredAssetId(asset.assetId)}
            onMouseLeave={() =>
              setHoveredAssetId((current) => (current === asset.assetId ? null : current))
            }
            data-preview-active={hoveredAssetId === asset.assetId}
            className={`border p-2 text-xs ${highlightAssetId === asset.assetId ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
          >
            <button
              type="button"
              className="w-full text-left hover:text-primary"
              onClick={() => onApplyPersonal?.(asset)}
            >
              <CustomFaceAnimatedPreview
                width={asset.width}
                height={asset.height}
                frames={[{ durationMs: 200, packedPixels: asset.packedPixels }]}
                ariaLabel={t('customFaceEditor.assets.preview', { name: asset.name })}
                className="h-12 w-full"
                active={hoveredAssetId === asset.assetId}
              />
              <span className="mt-1 block">{asset.name}</span>
              {asset.tags.length ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('customFaceEditor.assets.tags', { tags: asset.tags.join(', ') })}
                </span>
              ) : null}
            </button>
            {editingAssetId === asset.assetId ? (
              <div className="mt-1 flex gap-1">
                <input
                  aria-label={t('customFaceEditor.assets.name')}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="min-w-0 flex-1 border border-border px-1"
                />
                <button
                  type="button"
                  aria-label={t('customFaceEditor.assets.confirmRename')}
                  className="text-primary"
                  disabled={!draftName.trim()}
                  onClick={() => {
                    onRenamePersonal?.(asset, draftName.trim());
                    setEditingAssetId(null);
                  }}
                >
                  {t('customFaceEditor.assets.confirmRename')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-1 mr-2 text-primary"
                onClick={() => {
                  setEditingAssetId(asset.assetId);
                  setDraftName(asset.name);
                }}
              >
                {t('customFaceEditor.assets.rename')}
              </button>
            )}
            {editingTagsId === asset.assetId ? (
              <div className="mt-1 flex gap-1">
                <input
                  aria-label={t('customFaceEditor.assets.tagInput')}
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  className="min-w-0 flex-1 border border-border px-1"
                />
                <button
                  type="button"
                  aria-label={t('customFaceEditor.assets.confirmTags')}
                  className="text-primary"
                  onClick={() => {
                    onUpdateTags?.(
                      asset,
                      draftTags
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    );
                    setEditingTagsId(null);
                  }}
                >
                  {t('customFaceEditor.assets.confirmTags')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-1 mr-2 text-muted-foreground"
                onClick={() => {
                  setEditingTagsId(asset.assetId);
                  setDraftTags(asset.tags.join(','));
                }}
              >
                {t('customFaceEditor.assets.tag')}
              </button>
            )}
            <button
              type="button"
              className="mt-1 text-destructive"
              onClick={() => {
                if (
                  window.confirm(t('customFaceEditor.assets.deleteConfirm', { name: asset.name }))
                )
                  onDeletePersonal?.(asset.assetId);
              }}
            >
              {t('customFaceEditor.assets.delete')}
            </button>
          </div>
        ))}
        {visibleAssets.length === 0 ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            {t('customFaceEditor.assets.empty')}
          </p>
        ) : null}
      </div>
      {onSaveCurrent ? (
        <div className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3">
          <button
            type="button"
            className="border border-border px-2 py-1 text-xs"
            onClick={() => onSaveCurrent('group')}
          >
            {t('customFaceEditor.assets.saveGroup')}
          </button>
          <button
            type="button"
            className="border border-border px-2 py-1 text-xs"
            onClick={() => onSaveCurrent('public')}
          >
            {t('customFaceEditor.assets.savePublic')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
