import { RIGHT_TABS } from "@/features/editor/constants";
import { TemplatesPanel } from "@/features/editor/components/TemplatesPanel";
import { TextPanel } from "@/features/editor/components/TextPanel";
import { TransitionsPanel } from "@/features/editor/components/TransitionsPanel";
import { AIAudioPanel } from "@/features/editor/components/AIAudioPanel";

export function RightPanelBody({ rightTab, setRightTab, applyTemplate, project, textStyle, onTextStyleChange, onProjectStyleChange, addCaptionAtPlayhead, headerExtra, cleaningAudio, onCleanAudio }) {
  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden flex flex-col h-full">
      <div className="p-2 border-b border-line flex items-center gap-1">
        <div className="flex gap-1 flex-1 min-w-0">
          {RIGHT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setRightTab(t)}
              data-testid={`right-tab-${t.toLowerCase().replace(/\s/g, "-")}`}
              title={t}
              className={`flex-1 min-w-0 truncate text-xs px-1 py-2 rounded-md transition-colors ${rightTab === t ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {headerExtra}
      </div>

      {rightTab === "Templates" && (
        <TemplatesPanel onPick={applyTemplate} current={project.subtitle_style} />
      )}
      {rightTab === "Text" && (
        <TextPanel
          project={project}
          textStyle={textStyle}
          onTextStyleChange={onTextStyleChange}
          onProjectStyleChange={onProjectStyleChange}
          onAddText={addCaptionAtPlayhead}
        />
      )}
      {rightTab === "Transitions" && (
        <TransitionsPanel />
      )}
      {rightTab === "AI Audio" && (
        <AIAudioPanel cleaningAudio={cleaningAudio} onCleanAudio={onCleanAudio} />
      )}
      {rightTab !== "Templates" && rightTab !== "Text" && rightTab !== "Transitions" && rightTab !== "AI Audio" && (
        <div className="p-6 text-center text-xs text-muted-ink">
          {rightTab} — coming soon
        </div>
      )}
    </div>
  );
}
