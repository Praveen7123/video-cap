import { Type as FontIcon } from "lucide-react";

export function CustomFontsPanel() {
  return (
    <div className="flex-1 min-h-0 bg-card border border-line rounded-xl overflow-hidden flex flex-col p-4 space-y-4">
      <h3 className="text-sm font-medium">Custom Fonts</h3>
      <div className="border-2 border-dashed border-line rounded-xl p-8 flex flex-col items-center justify-center text-center opacity-60">
        <FontIcon className="w-8 h-8 text-muted-ink mb-3" />
        <h4 className="text-sm font-semibold mb-1">Upload Brand Fonts</h4>
        <p className="text-xs text-muted-ink">Upload .ttf or .otf files to use them in your captions.</p>
        <button disabled className="mt-4 bg-bg-2 border border-line text-xs py-2 px-4 rounded-md cursor-not-allowed">
          Coming Soon
        </button>
      </div>
    </div>
  );
}
