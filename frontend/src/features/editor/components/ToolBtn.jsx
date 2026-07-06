export function ToolBtn({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-md text-muted-ink hover:text-ink hover:bg-bg-2 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
