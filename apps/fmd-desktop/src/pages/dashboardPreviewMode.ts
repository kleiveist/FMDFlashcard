export type DashboardView = "markdown" | "exam";

export const shouldApplyPreviewDefaultMode = ({
  didApplyDefault,
  settingsLoaded,
  isEditing,
  vaultView,
}: {
  didApplyDefault: boolean;
  settingsLoaded: boolean;
  isEditing: boolean;
  vaultView: DashboardView;
}) => settingsLoaded && !didApplyDefault && !isEditing && vaultView === "markdown";
