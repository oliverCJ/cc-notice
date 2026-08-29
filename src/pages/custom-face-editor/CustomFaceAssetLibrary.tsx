import type { BuiltinCustomFaceAsset } from '@/domain/customFaces/assets/builtinAssets';

export function CustomFaceAssetLibrary({ assets, onApply }: { assets: BuiltinCustomFaceAsset[]; onApply: (asset: BuiltinCustomFaceAsset) => void }) {
  return <section aria-label="内置素材库" className="border-t border-border pt-3"><h2 className="font-medium">内置素材</h2><div className="mt-2 grid grid-cols-2 gap-2">{assets.map((asset) => <button key={asset.assetId} type="button" className="border border-border p-2 text-left text-xs hover:border-primary" onClick={() => onApply(asset)}><span className="block h-12 bg-black" /><span className="mt-1 block">{asset.name}</span><span className="text-muted-foreground">只读素材</span></button>)}</div></section>;
}
