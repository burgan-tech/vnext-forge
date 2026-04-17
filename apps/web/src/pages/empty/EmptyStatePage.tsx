export function EmptyStatePage() {
  return (
    <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">vnext-forge Designer</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Open a vnext component from the VS Code Explorer to start designing.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Right-click a <code>.json</code> file under your workspace and choose
          &quot;Open Designer&quot;, or use the Command Palette to create a new project or
          component.
        </p>
      </div>
    </div>
  );
}
